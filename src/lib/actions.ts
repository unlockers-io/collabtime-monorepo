"use server";

import { v4 as uuidv4 } from "uuid";
import { redis, SESSION_TTL_SECONDS, TEAM_ACTIVE_TTL_SECONDS, TEAM_INITIAL_TTL_SECONDS } from "./redis";
import { realtime } from "./realtime";
import {
  TeamAuthInputSchema,
  TeamCreateInputSchema,
  TeamGroupInputSchema,
  TeamGroupUpdateSchema,
  TeamMemberInputSchema,
  TeamMemberUpdateSchema,
  TeamPasswordUpdateSchema,
  UUIDSchema,
} from "./validation";
import { hashPassword, verifyPassword } from "./crypto";
import type { ServerSession, Team, TeamGroup, TeamMember, TeamRecord, TeamRole } from "@/types";
import z from "zod";

type ActionResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};

// ============================================================================
// Session Token Management
// ============================================================================

const generateSessionToken = (): string => {
  // Generate a cryptographically secure random token
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const createSession = async (
  teamId: string,
  role: TeamRole
): Promise<string> => {
  const token = generateSessionToken();
  const session: ServerSession = {
    teamId,
    role,
    createdAt: Date.now(),
  };

  await redis.set(`session:${token}`, JSON.stringify(session), {
    ex: SESSION_TTL_SECONDS,
  });

  return token;
};

const getSession = async (token: string): Promise<ServerSession | null> => {
  try {
    const data = await redis.get<string>(`session:${token}`);
    if (!data) return null;
    return typeof data === "string" ? JSON.parse(data) : data;
  } catch {
    return null;
  }
};

const deleteSession = async (token: string): Promise<void> => {
  await redis.del(`session:${token}`);
};

const verifySessionForTeam = async (
  token: string,
  teamId: string,
  requireAdmin: boolean = false
): Promise<ActionResult<{ role: TeamRole }>> => {
  const session = await getSession(token);

  if (!session) {
    return { success: false, error: "Session expired" };
  }

  if (session.teamId !== teamId) {
    return { success: false, error: "Invalid session" };
  }

  if (requireAdmin && session.role !== "admin") {
    return { success: false, error: "Admin access required" };
  }

  return { success: true, data: { role: session.role } };
};

// ============================================================================
// Team Management
// ============================================================================

const createTeam = async (
  adminPassword: string,
  memberPassword: string
): Promise<ActionResult<string>> => {
  try {
    const inputResult = TeamCreateInputSchema.safeParse({
      adminPassword,
      memberPassword,
    });
    if (!inputResult.success) {
      const errorMessage =
        inputResult.error.issues[0]?.message ?? "Invalid password";
      return { success: false, error: errorMessage };
    }

    const teamId = uuidv4();
    const adminPasswordHash = await hashPassword(adminPassword);
    const memberPasswordHash = await hashPassword(memberPassword);

    const team: TeamRecord = {
      id: teamId,
      name: "",
      createdAt: new Date().toISOString(),
      members: [],
      groups: [],
      adminPasswordHash,
      memberPasswordHash,
    };

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_INITIAL_TTL_SECONDS,
    });

    return { success: true, data: teamId };
  } catch (error) {
    console.error("Failed to create team:", error);
    return { success: false, error: "Failed to create team" };
  }
};

const authenticateTeam = async (
  teamId: string,
  password: string
): Promise<ActionResult<{ token: string; role: TeamRole }>> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const authResult = TeamAuthInputSchema.safeParse({ password });
    if (!authResult.success) {
      const errorMessage =
        authResult.error.issues[0]?.message ?? "Invalid password";
      return { success: false, error: errorMessage };
    }

    if (!team.adminPasswordHash || !team.memberPasswordHash) {
      return { success: false, error: "This team is not accessible" };
    }

    // Check admin password first
    const isAdmin = await verifyPassword(password, team.adminPasswordHash);
    if (isAdmin) {
      const token = await createSession(teamId, "admin");
      return { success: true, data: { token, role: "admin" } };
    }

    // Check member password
    const isMember = await verifyPassword(password, team.memberPasswordHash);
    if (isMember) {
      const token = await createSession(teamId, "member");
      return { success: true, data: { token, role: "member" } };
    }

    return { success: false, error: "Invalid password" };
  } catch (error) {
    console.error("Failed to authenticate team:", error);
    return { success: false, error: "Failed to authenticate" };
  }
};

const verifyAdminAccessByToken = async (
  token: string,
  teamId: string
): Promise<ActionResult<boolean>> => {
  const sessionResult = await verifySessionForTeam(token, teamId, true);
  if (!sessionResult.success) {
    return { success: false, error: sessionResult.error };
  }
  return { success: true, data: true };
};

const updateTeamPasswords = async (
  teamId: string,
  currentAdminPassword: string,
  updates: { adminPassword?: string; memberPassword?: string }
): Promise<ActionResult<void>> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const updateResult = TeamPasswordUpdateSchema.safeParse({
      currentAdminPassword,
      ...updates,
    });
    if (!updateResult.success) {
      const errorMessage =
        updateResult.error.issues[0]?.message ?? "Invalid password data";
      return { success: false, error: errorMessage };
    }

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    // Verify current admin password
    if (team.adminPasswordHash) {
      const isAdmin = await verifyPassword(
        currentAdminPassword,
        team.adminPasswordHash
      );
      if (!isAdmin) {
        return { success: false, error: "Invalid current admin password" };
      }
    }

    // Update passwords
    if (updates.adminPassword) {
      team.adminPasswordHash = await hashPassword(updates.adminPassword);
    }
    if (updates.memberPassword) {
      team.memberPasswordHash = await hashPassword(updates.memberPassword);
    }

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Failed to update team passwords:", error);
    return { success: false, error: "Failed to update passwords" };
  }
};

const sanitizeTeam = (team: TeamRecord): Team => {
  // Destructure to exclude password hashes from public team data
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { adminPasswordHash, memberPasswordHash, ...publicTeam } = team;
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

    const team = typeof data === "string" ? JSON.parse(data) : data;

    // Ensure groups array exists for backward compatibility
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

const getTeamByToken = async (
  token: string,
  teamId: string
): Promise<ActionResult<{ team: Team; role: TeamRole }>> => {
  try {
    const sessionResult = await verifySessionForTeam(token, teamId);
    if (!sessionResult.success) {
      return { success: false, error: sessionResult.error };
    }

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    return { success: true, data: { team: sanitizeTeam(team), role: sessionResult.data.role } };
  } catch (error) {
    console.error("Failed to fetch team by token:", error);
    return { success: false, error: "Failed to fetch team" };
  }
};

const addMember = async (
  teamId: string,
  token: string,
  member: Omit<TeamMember, "id">
): Promise<ActionResult<{ team: Team; member: TeamMember }>> => {
  try {
    // Verify admin access first
    const accessResult = await verifyAdminAccessByToken(token, teamId);
    if (!accessResult.success) {
      return { success: false, error: accessResult.error };
    }

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

    // Use longer TTL when members are added (2 years)
    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    // Emit realtime event to team channel
    await realtime.channel(`team-${teamId}`).emit("team.memberAdded", newMember);

    return { success: true, data: { team: sanitizeTeam(team), member: newMember } };
  } catch (error) {
    console.error("Failed to add member:", error);
    return { success: false, error: "Failed to add member" };
  }
};

const removeMember = async (
  teamId: string,
  token: string,
  memberId: string
): Promise<ActionResult<Team>> => {
  try {
    const accessResult = await verifyAdminAccessByToken(token, teamId);
    if (!accessResult.success) {
      return { success: false, error: accessResult.error };
    }

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

    // Keep the active TTL since team has activity
    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    // Emit realtime event to team channel
    await realtime.channel(`team-${teamId}`).emit("team.memberRemoved", { memberId });

    return { success: true, data: sanitizeTeam(team) };
  } catch (error) {
    console.error("Failed to remove member:", error);
    return { success: false, error: "Failed to remove member" };
  }
};

const updateMember = async (
  teamId: string,
  token: string,
  memberId: string,
  updates: Partial<Omit<TeamMember, "id">>
): Promise<ActionResult<Team>> => {
  try {
    const accessResult = await verifyAdminAccessByToken(token, teamId);
    if (!accessResult.success) {
      return { success: false, error: accessResult.error };
    }

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

    // Keep the active TTL since team has activity
    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    // Emit realtime event to team channel
    await realtime.channel(`team-${teamId}`).emit("team.memberUpdated", updatedMember);

    return { success: true, data: sanitizeTeam(team) };
  } catch (error) {
    console.error("Failed to update member:", error);
    return { success: false, error: "Failed to update member" };
  }
};

const reorderMembers = async (
  teamId: string,
  token: string,
  orderedIds: string[]
): Promise<ActionResult<Team>> => {
  try {
    const accessResult = await verifyAdminAccessByToken(token, teamId);
    if (!accessResult.success) {
      return { success: false, error: accessResult.error };
    }

    const teamUuidResult = UUIDSchema.safeParse(teamId);
    if (!teamUuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const idsResult = z.array(UUIDSchema).safeParse(orderedIds);
    if (!idsResult.success) {
      return { success: false, error: "Invalid member IDs" };
    }

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    // Ensure provided IDs match the existing member set
    const existingIds = new Set(team.members.map((m) => m.id));
    const providedIds = new Set(orderedIds);
    if (existingIds.size !== providedIds.size) {
      return { success: false, error: "Member list mismatch" };
    }
    for (const id of existingIds) {
      if (!providedIds.has(id)) {
        return { success: false, error: "Member list mismatch" };
      }
    }

    // Reorder members to match the provided order
    const memberMap = new Map(team.members.map((m) => [m.id, m]));
    team.members = orderedIds.map((id) => memberMap.get(id)!);

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    await realtime.channel(`team-${teamId}`).emit("team.membersReordered", {
      order: orderedIds,
    });

    return { success: true, data: sanitizeTeam(team) };
  } catch (error) {
    console.error("Failed to reorder members:", error);
    return { success: false, error: "Failed to reorder members" };
  }
};

const updateTeamName = async (
  teamId: string,
  token: string,
  name: string
): Promise<ActionResult<Team>> => {
  try {
    const accessResult = await verifyAdminAccessByToken(token, teamId);
    if (!accessResult.success) {
      return { success: false, error: accessResult.error };
    }

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

const createGroup = async (
  teamId: string,
  token: string,
  input: { name: string }
): Promise<ActionResult<{ team: Team; group: TeamGroup }>> => {
  try {
    const accessResult = await verifyAdminAccessByToken(token, teamId);
    if (!accessResult.success) {
      return { success: false, error: accessResult.error };
    }

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

    return { success: true, data: { team: sanitizeTeam(team), group: newGroup } };
  } catch (error) {
    console.error("Failed to create group:", error);
    return { success: false, error: "Failed to create group" };
  }
};

const updateGroup = async (
  teamId: string,
  token: string,
  groupId: string,
  updates: Partial<{ name: string }>
): Promise<ActionResult<Team>> => {
  try {
    const accessResult = await verifyAdminAccessByToken(token, teamId);
    if (!accessResult.success) {
      return { success: false, error: accessResult.error };
    }

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

const removeGroup = async (
  teamId: string,
  token: string,
  groupId: string
): Promise<ActionResult<Team>> => {
  try {
    const accessResult = await verifyAdminAccessByToken(token, teamId);
    if (!accessResult.success) {
      return { success: false, error: accessResult.error };
    }

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

    // Remove the group
    team.groups = team.groups.filter((g) => g.id !== groupId);

    // Unassign all members from this group
    team.members = team.members.map((m) =>
      m.groupId === groupId ? { ...m, groupId: undefined } : m
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

const reorderGroups = async (
  teamId: string,
  token: string,
  orderedIds: string[]
): Promise<ActionResult<Team>> => {
  try {
    const accessResult = await verifyAdminAccessByToken(token, teamId);
    if (!accessResult.success) {
      return { success: false, error: accessResult.error };
    }

    const teamUuidResult = UUIDSchema.safeParse(teamId);
    if (!teamUuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const idsResult = z.array(UUIDSchema).safeParse(orderedIds);
    if (!idsResult.success) {
      return { success: false, error: "Invalid group IDs" };
    }

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    // Ensure provided IDs match the existing group set
    const existingIds = new Set(team.groups.map((g) => g.id));
    const providedIds = new Set(orderedIds);
    if (existingIds.size !== providedIds.size) {
      return { success: false, error: "Group list mismatch" };
    }
    for (const id of existingIds) {
      if (!providedIds.has(id)) {
        return { success: false, error: "Group list mismatch" };
      }
    }

    // Reorder groups to match the provided order and update order values
    const groupMap = new Map(team.groups.map((g) => [g.id, g]));
    team.groups = orderedIds.map((id, index) => ({
      ...groupMap.get(id)!,
      order: index,
    }));

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    await realtime.channel(`team-${teamId}`).emit("team.groupsReordered", {
      order: orderedIds,
    });

    return { success: true, data: sanitizeTeam(team) };
  } catch (error) {
    console.error("Failed to reorder groups:", error);
    return { success: false, error: "Failed to reorder groups" };
  }
};

export {
  addMember,
  authenticateTeam,
  createGroup,
  createTeam,
  deleteSession,
  getTeamByToken,
  removeGroup,
  removeMember,
  reorderGroups,
  reorderMembers,
  updateGroup,
  updateMember,
  updateTeamName,
  updateTeamPasswords,
  validateTeam,
};
