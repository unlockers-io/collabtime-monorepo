"use server";

import { prisma } from "@repo/db";
import { v4 as uuidv4 } from "uuid";

import { requireTeamAdmin, requireAuth, getTeamRole } from "@/lib/team-auth";
import type { Team, TeamGroup, TeamMember, TeamRecord, TeamRole } from "@/types";

import { realtime } from "./realtime";
import { redis, TEAM_ACTIVE_TTL_SECONDS, TEAM_INITIAL_TTL_SECONDS } from "./redis";
import {
  TeamGroupInputSchema,
  TeamGroupUpdateSchema,
  TeamMemberInputSchema,
  TeamMemberUpdateSchema,
  UUIDSchema,
} from "./validation";

type ActionResult<T> =
  | {
      data: T;
      success: true;
    }
  | {
      error: string;
      success: false;
    };

// ============================================================================
// Internal Helpers
// ============================================================================

const sanitizeTeam = (team: TeamRecord): Team => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { adminPasswordHash, ...publicTeam } = team;
  return publicTeam;
};

const getTeamRecord = async (teamId: string): Promise<TeamRecord | null> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return null;
    }

    const data = await redis.get<string>(`team:${teamId}`);

    if (!data) {
      return null;
    }

    const team = (typeof data === "string" ? JSON.parse(data) : data) as TeamRecord;

    if (!team.groups) {
      team.groups = [];
    }
    if (!team.members) {
      team.members = [];
    }

    return team;
  } catch (error) {
    console.error("Failed to get team:", error);
    return null;
  }
};

// ============================================================================
// Team Read Operations (no auth required)
// ============================================================================

/**
 * Get a team for public (read-only) access.
 * No authentication required - anyone with the link can view.
 */
const getPublicTeam = async (
  teamId: string,
): Promise<ActionResult<{ role: TeamRole; team: Team }>> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    return {
      success: true,
      data: { team: sanitizeTeam(team), role: "member" },
    };
  } catch (error) {
    console.error("Failed to fetch public team:", error);
    return { success: false, error: "Failed to fetch team" };
  }
};

const validateTeam = async (teamId: string): Promise<boolean> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return false;
    }

    const exists = await redis.exists(`team:${teamId}`);
    return exists === 1;
  } catch (error) {
    console.error("Failed to validate team:", error);
    return false;
  }
};

const getTeamName = async (teamId: string): Promise<string | null> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return null;
    }

    const data = await redis.get<string>(`team:${teamId}`);
    if (!data) {
      return null;
    }

    const team = (typeof data === "string" ? JSON.parse(data) : data) as { name?: string };
    const name = typeof team?.name === "string" ? team.name.trim() : "";
    return name.length > 0 ? name : null;
  } catch (error) {
    console.error("Failed to get team name:", error);
    return null;
  }
};

// ============================================================================
// Team Creation (membership-based)
// ============================================================================

const createTeam = async (): Promise<ActionResult<string>> => {
  try {
    const session = await requireAuth();

    const teamId = uuidv4();

    const team: TeamRecord = {
      id: teamId,
      name: "",
      createdAt: new Date().toISOString(),
      members: [],
      groups: [],
    };

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_INITIAL_TTL_SECONDS,
    });

    // Create Space in Postgres
    await prisma.space.create({
      data: {
        teamId,
        isPrivate: false,
        ownerId: session.user.id,
      },
    });

    // Create Membership with admin role
    await prisma.membership.create({
      data: {
        userId: session.user.id,
        teamId,
        role: "admin",
      },
    });

    return { success: true, data: teamId };
  } catch (error) {
    console.error("Failed to create team:", error);
    return { success: false, error: "Failed to create team" };
  }
};

// ============================================================================
// Admin-Only Member Actions
// ============================================================================

const addMember = async (
  teamId: string,
  member: Omit<TeamMember, "id">,
): Promise<ActionResult<{ member: TeamMember; team: Team }>> => {
  try {
    await requireTeamAdmin(teamId);

    const memberResult = TeamMemberInputSchema.safeParse(member);
    if (!memberResult.success) {
      const errorMessage = memberResult.error.issues[0]?.message ?? "Invalid member data";
      return { success: false, error: errorMessage };
    }

    const team = await getTeamRecord(teamId);

    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const newMember: TeamMember = {
      ...memberResult.data,
      id: uuidv4(),
    };

    team.members.push(newMember);

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    await realtime.channel(`team-${teamId}`).emit("team.memberAdded", newMember);

    return {
      success: true,
      data: { team: sanitizeTeam(team), member: newMember },
    };
  } catch (error) {
    console.error("Failed to add member:", error);
    return { success: false, error: "Failed to add member" };
  }
};

const removeMember = async (teamId: string, memberId: string): Promise<ActionResult<Team>> => {
  try {
    await requireTeamAdmin(teamId);

    const teamUuidResult = UUIDSchema.safeParse(teamId);
    const memberUuidResult = UUIDSchema.safeParse(memberId);

    if (!teamUuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }
    if (!memberUuidResult.success) {
      return { success: false, error: "Invalid member ID" };
    }

    const team = await getTeamRecord(teamId);

    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const memberExists = team.members.some((m) => m.id === memberId);
    if (!memberExists) {
      return { success: false, error: "Member not found" };
    }

    team.members = team.members.filter((m) => m.id !== memberId);

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    await realtime.channel(`team-${teamId}`).emit("team.memberRemoved", { memberId });

    return { success: true, data: sanitizeTeam(team) };
  } catch (error) {
    console.error("Failed to remove member:", error);
    return { success: false, error: "Failed to remove member" };
  }
};

const updateMember = async (
  teamId: string,
  memberId: string,
  updates: Partial<Omit<TeamMember, "id">>,
): Promise<ActionResult<Team>> => {
  try {
    await requireTeamAdmin(teamId);

    const teamUuidResult = UUIDSchema.safeParse(teamId);
    const memberUuidResult = UUIDSchema.safeParse(memberId);

    if (!teamUuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }
    if (!memberUuidResult.success) {
      return { success: false, error: "Invalid member ID" };
    }

    const updateResult = TeamMemberUpdateSchema.safeParse(updates);
    if (!updateResult.success) {
      const errorMessage = updateResult.error.issues[0]?.message ?? "Invalid update data";
      return { success: false, error: errorMessage };
    }

    const team = await getTeamRecord(teamId);

    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const memberIndex = team.members.findIndex((m) => m.id === memberId);

    if (memberIndex === -1) {
      return { success: false, error: "Member not found" };
    }

    const updatedMember = {
      ...team.members[memberIndex],
      ...updateResult.data,
    };

    team.members[memberIndex] = updatedMember;

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    await realtime.channel(`team-${teamId}`).emit("team.memberUpdated", updatedMember);

    return { success: true, data: sanitizeTeam(team) };
  } catch (error) {
    console.error("Failed to update member:", error);
    return { success: false, error: "Failed to update member" };
  }
};

const updateTeamName = async (teamId: string, name: string): Promise<ActionResult<Team>> => {
  try {
    await requireTeamAdmin(teamId);

    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const trimmedName = name.trim().slice(0, 100);

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    team.name = trimmedName;

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    await realtime.channel(`team-${teamId}`).emit("team.nameUpdated", {
      name: trimmedName,
    });

    return { success: true, data: sanitizeTeam(team) };
  } catch (error) {
    console.error("Failed to update team name:", error);
    return { success: false, error: "Failed to update team name" };
  }
};

const importMembers = async (
  teamId: string,
  members: Array<Omit<TeamMember, "id">>,
): Promise<ActionResult<{ imported: number; members: Array<TeamMember>; team: Team }>> => {
  try {
    await requireTeamAdmin(teamId);

    if (!Array.isArray(members) || members.length === 0) {
      return { success: false, error: "No members to import" };
    }

    if (members.length > 100) {
      return { success: false, error: "Cannot import more than 100 members at once" };
    }

    const validated: Array<TeamMember> = [];
    for (const member of members) {
      const result = TeamMemberInputSchema.safeParse(member);
      if (!result.success) {
        const msg = result.error.issues[0]?.message ?? "Invalid member data";
        return { success: false, error: `Invalid member "${member.name}": ${msg}` };
      }
      validated.push({ ...result.data, id: uuidv4() });
    }

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    team.members.push(...validated);

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    await realtime.channel(`team-${teamId}`).emit("team.membersImported", validated);

    return {
      success: true,
      data: { imported: validated.length, members: validated, team: sanitizeTeam(team) },
    };
  } catch (error) {
    console.error("Failed to import members:", error);
    return { success: false, error: "Failed to import members" };
  }
};

// ============================================================================
// Admin-Only Group Actions
// ============================================================================

const createGroup = async (
  teamId: string,
  input: { name: string },
): Promise<ActionResult<{ group: TeamGroup; team: Team }>> => {
  try {
    await requireTeamAdmin(teamId);

    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const inputResult = TeamGroupInputSchema.safeParse(input);
    if (!inputResult.success) {
      const errorMessage = inputResult.error.issues[0]?.message ?? "Invalid group data";
      return { success: false, error: errorMessage };
    }

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const newGroup: TeamGroup = {
      id: uuidv4(),
      name: inputResult.data.name,
      order: team.groups.length,
    };

    team.groups.push(newGroup);

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    await realtime.channel(`team-${teamId}`).emit("team.groupCreated", newGroup);

    return {
      success: true,
      data: { team: sanitizeTeam(team), group: newGroup },
    };
  } catch (error) {
    console.error("Failed to create group:", error);
    return { success: false, error: "Failed to create group" };
  }
};

const updateGroup = async (
  teamId: string,
  groupId: string,
  updates: Partial<{ name: string }>,
): Promise<ActionResult<Team>> => {
  try {
    await requireTeamAdmin(teamId);

    const teamUuidResult = UUIDSchema.safeParse(teamId);
    const groupUuidResult = UUIDSchema.safeParse(groupId);

    if (!teamUuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }
    if (!groupUuidResult.success) {
      return { success: false, error: "Invalid group ID" };
    }

    const updateResult = TeamGroupUpdateSchema.safeParse(updates);
    if (!updateResult.success) {
      const errorMessage = updateResult.error.issues[0]?.message ?? "Invalid update data";
      return { success: false, error: errorMessage };
    }

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const groupIndex = team.groups.findIndex((g) => g.id === groupId);
    if (groupIndex === -1) {
      return { success: false, error: "Group not found" };
    }

    const updatedGroup = {
      ...team.groups[groupIndex],
      ...updateResult.data,
    };

    team.groups[groupIndex] = updatedGroup;

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    await realtime.channel(`team-${teamId}`).emit("team.groupUpdated", updatedGroup);

    return { success: true, data: sanitizeTeam(team) };
  } catch (error) {
    console.error("Failed to update group:", error);
    return { success: false, error: "Failed to update group" };
  }
};

const removeGroup = async (teamId: string, groupId: string): Promise<ActionResult<Team>> => {
  try {
    await requireTeamAdmin(teamId);

    const teamUuidResult = UUIDSchema.safeParse(teamId);
    const groupUuidResult = UUIDSchema.safeParse(groupId);

    if (!teamUuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }
    if (!groupUuidResult.success) {
      return { success: false, error: "Invalid group ID" };
    }

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const groupExists = team.groups.some((g) => g.id === groupId);
    if (!groupExists) {
      return { success: false, error: "Group not found" };
    }

    team.groups = team.groups.filter((g) => g.id !== groupId);

    // Unassign all members from this group
    team.members = team.members.map((m) =>
      m.groupId === groupId ? { ...m, groupId: undefined } : m,
    );

    // Update order values for remaining groups
    team.groups = team.groups.map((g, index) => ({ ...g, order: index }));

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    await realtime.channel(`team-${teamId}`).emit("team.groupRemoved", { groupId });

    return { success: true, data: sanitizeTeam(team) };
  } catch (error) {
    console.error("Failed to remove group:", error);
    return { success: false, error: "Failed to remove group" };
  }
};

// ============================================================================
// Self-Edit Action (authenticated users editing their own member record)
// ============================================================================

const updateOwnMember = async (
  teamId: string,
  updates: Partial<
    Pick<TeamMember, "name" | "title" | "timezone" | "workingHoursStart" | "workingHoursEnd">
  >,
): Promise<ActionResult<Team>> => {
  try {
    const session = await requireAuth();

    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const updateResult = TeamMemberUpdateSchema.safeParse(updates);
    if (!updateResult.success) {
      const errorMessage = updateResult.error.issues[0]?.message ?? "Invalid update data";
      return { success: false, error: errorMessage };
    }

    // Strip groupId from updates to prevent self-assignment to groups
    const { groupId: _stripGroupId, ...safeUpdates } = updateResult.data as Partial<TeamMember>;

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const memberIndex = team.members.findIndex((m) => m.userId === session.user.id);
    if (memberIndex === -1) {
      return { success: false, error: "You are not a member of this team" };
    }

    const updatedMember = {
      ...team.members[memberIndex],
      ...safeUpdates,
    };

    team.members[memberIndex] = updatedMember;

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    await realtime.channel(`team-${teamId}`).emit("team.memberUpdated", updatedMember);

    return { success: true, data: sanitizeTeam(team) };
  } catch (error) {
    console.error("Failed to update own member:", error);
    return { success: false, error: "Failed to update member" };
  }
};

// ============================================================================
// Join Request Actions
// ============================================================================

const requestToJoin = async (teamId: string): Promise<ActionResult<{ requestId: string }>> => {
  try {
    const session = await requireAuth();

    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    // Verify team exists in Redis
    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    // Check for existing membership
    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    if (existingMembership) {
      return { success: false, error: "You are already a member of this team" };
    }

    // Check for existing pending request
    const existingRequest = await prisma.joinRequest.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    if (existingRequest && existingRequest.status === "pending") {
      return { success: false, error: "You already have a pending request for this team" };
    }

    // Create or upsert the join request (handles re-requesting after denial)
    const joinRequest = await prisma.joinRequest.upsert({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
      update: {
        status: "pending",
      },
      create: {
        userId: session.user.id,
        teamId,
        status: "pending",
      },
    });

    return { success: true, data: { requestId: joinRequest.id } };
  } catch (error) {
    console.error("Failed to request to join:", error);
    return { success: false, error: "Failed to submit join request" };
  }
};

const approveJoinRequest = async (
  requestId: string,
): Promise<ActionResult<{ memberId: string }>> => {
  try {
    const joinRequest = await prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!joinRequest) {
      return { success: false, error: "Join request not found" };
    }

    if (joinRequest.status !== "pending") {
      return { success: false, error: "Join request is no longer pending" };
    }

    // Verify caller is admin of the team this request belongs to
    await requireTeamAdmin(joinRequest.teamId);

    // Update request status
    await prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: "approved" },
    });

    // Create membership
    await prisma.membership.create({
      data: {
        userId: joinRequest.userId,
        teamId: joinRequest.teamId,
        role: "member",
      },
    });

    // Add TeamMember to Redis
    const team = await getTeamRecord(joinRequest.teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const memberName = joinRequest.user.name || joinRequest.user.email.split("@")[0] || "Unknown";

    const newMember: TeamMember = {
      id: uuidv4(),
      name: memberName,
      title: "",
      timezone: "America/New_York",
      workingHoursStart: 9,
      workingHoursEnd: 17,
      userId: joinRequest.userId,
    };

    team.members.push(newMember);

    await redis.set(`team:${joinRequest.teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    await realtime.channel(`team-${joinRequest.teamId}`).emit("team.memberAdded", newMember);

    return { success: true, data: { memberId: newMember.id } };
  } catch (error) {
    console.error("Failed to approve join request:", error);
    return { success: false, error: "Failed to approve join request" };
  }
};

const denyJoinRequest = async (requestId: string): Promise<ActionResult<void>> => {
  try {
    const joinRequest = await prisma.joinRequest.findUnique({
      where: { id: requestId },
    });

    if (!joinRequest) {
      return { success: false, error: "Join request not found" };
    }

    if (joinRequest.status !== "pending") {
      return { success: false, error: "Join request is no longer pending" };
    }

    await requireTeamAdmin(joinRequest.teamId);

    await prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: "denied" },
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Failed to deny join request:", error);
    return { success: false, error: "Failed to deny join request" };
  }
};

const getPendingJoinRequests = async (
  teamId: string,
): Promise<
  ActionResult<
    Array<{ createdAt: Date; id: string; userEmail: string; userId: string; userName: string }>
  >
> => {
  try {
    await requireTeamAdmin(teamId);

    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const requests = await prisma.joinRequest.findMany({
      where: {
        teamId,
        status: "pending",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const data = requests.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name || r.user.email.split("@")[0] || "Unknown",
      userEmail: r.user.email,
      createdAt: r.createdAt,
    }));

    return { success: true, data };
  } catch (error) {
    console.error("Failed to get pending join requests:", error);
    return { success: false, error: "Failed to get join requests" };
  }
};

const getMyTeamStatus = async (
  teamId: string,
): Promise<ActionResult<{ status: "admin" | "member" | "pending" | "none" }>> => {
  try {
    const session = await requireAuth();

    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    // Check membership first
    const teamRole = await getTeamRole(teamId);
    if (teamRole) {
      return { success: true, data: { status: teamRole.role } };
    }

    // Check for pending join request
    const pendingRequest = await prisma.joinRequest.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    if (pendingRequest && pendingRequest.status === "pending") {
      return { success: true, data: { status: "pending" } };
    }

    return { success: true, data: { status: "none" } };
  } catch (error) {
    console.error("Failed to get team status:", error);
    return { success: false, error: "Failed to get team status" };
  }
};

export {
  addMember,
  approveJoinRequest,
  createGroup,
  createTeam,
  denyJoinRequest,
  getMyTeamStatus,
  getPendingJoinRequests,
  getPublicTeam,
  getTeamName,
  importMembers,
  removeGroup,
  removeMember,
  requestToJoin,
  updateGroup,
  updateMember,
  updateOwnMember,
  updateTeamName,
  validateTeam,
};
