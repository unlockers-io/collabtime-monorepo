"use server";

import { prisma } from "@repo/db";
import { v4 as uuidv4 } from "uuid";

import { requireAuth, requireTeamAdmin } from "@/lib/team-auth";
import type { Team, TeamMember } from "@/types";

import { realtime } from "../realtime";
import { redis, TEAM_ACTIVE_TTL_SECONDS } from "../redis";
import { TeamMemberInputSchema, TeamMemberUpdateSchema, UUIDSchema } from "../validation";

import { getTeamRecord, sanitizeTeam } from "./helpers";
import type { ActionResult } from "./types";

const addMember = async (
  teamId: string,
  member: Omit<TeamMember, "id" | "order">,
): Promise<ActionResult<{ member: TeamMember; team: Team }>> => {
  try {
    const memberResult = TeamMemberInputSchema.safeParse(member);
    if (!memberResult.success) {
      const errorMessage = memberResult.error.issues[0]?.message ?? "Invalid member data";
      return { success: false, error: errorMessage };
    }

    await requireTeamAdmin(teamId);

    const team = await getTeamRecord(teamId);

    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const newMember: TeamMember = {
      ...memberResult.data,
      id: uuidv4(),
      order: team.members.length,
    };

    team.members.push(newMember);

    await Promise.all([
      redis.set(`team:${teamId}`, JSON.stringify(team), {
        ex: TEAM_ACTIVE_TTL_SECONDS,
      }),
      realtime.channel(`team-${teamId}`).emit("team.memberAdded", newMember),
    ]);

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
    const teamUuidResult = UUIDSchema.safeParse(teamId);
    const memberUuidResult = UUIDSchema.safeParse(memberId);

    if (!teamUuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }
    if (!memberUuidResult.success) {
      return { success: false, error: "Invalid member ID" };
    }

    await requireTeamAdmin(teamId);

    const team = await getTeamRecord(teamId);

    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const memberExists = team.members.some((m) => m.id === memberId);
    if (!memberExists) {
      return { success: false, error: "Member not found" };
    }

    team.members = team.members.filter((m) => m.id !== memberId);

    await Promise.all([
      redis.set(`team:${teamId}`, JSON.stringify(team), {
        ex: TEAM_ACTIVE_TTL_SECONDS,
      }),
      realtime.channel(`team-${teamId}`).emit("team.memberRemoved", { memberId }),
    ]);

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

    await requireTeamAdmin(teamId);

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

    await Promise.all([
      redis.set(`team:${teamId}`, JSON.stringify(team), {
        ex: TEAM_ACTIVE_TTL_SECONDS,
      }),
      realtime.channel(`team-${teamId}`).emit("team.memberUpdated", updatedMember),
    ]);

    return { success: true, data: sanitizeTeam(team) };
  } catch (error) {
    console.error("Failed to update member:", error);
    return { success: false, error: "Failed to update member" };
  }
};

const updateTeamName = async (teamId: string, name: string): Promise<ActionResult<Team>> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const trimmedName = name.trim().slice(0, 100);
    if (!trimmedName) {
      return { success: false, error: "Team name cannot be empty" };
    }

    await requireTeamAdmin(teamId);

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    team.name = trimmedName;

    await Promise.all([
      redis.set(`team:${teamId}`, JSON.stringify(team), {
        ex: TEAM_ACTIVE_TTL_SECONDS,
      }),
      realtime.channel(`team-${teamId}`).emit("team.nameUpdated", {
        name: trimmedName,
      }),
    ]);

    return { success: true, data: sanitizeTeam(team) };
  } catch (error) {
    console.error("Failed to update team name:", error);
    return { success: false, error: "Failed to update team name" };
  }
};

const importMembers = async (
  teamId: string,
  members: Array<Omit<TeamMember, "id" | "order">>,
): Promise<ActionResult<{ imported: number; members: Array<TeamMember>; team: Team }>> => {
  try {
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
      validated.push({ ...result.data, id: uuidv4(), order: 0 });
    }

    await requireTeamAdmin(teamId);

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const startOrder = team.members.length;
    const orderedValidated = validated.map((m, i) => ({ ...m, order: startOrder + i }));
    team.members.push(...orderedValidated);

    await Promise.all([
      redis.set(`team:${teamId}`, JSON.stringify(team), {
        ex: TEAM_ACTIVE_TTL_SECONDS,
      }),
      realtime.channel(`team-${teamId}`).emit("team.membersImported", validated),
    ]);

    return {
      success: true,
      data: { imported: validated.length, members: validated, team: sanitizeTeam(team) },
    };
  } catch (error) {
    console.error("Failed to import members:", error);
    return { success: false, error: "Failed to import members" };
  }
};

/**
 * Allows an authenticated user to edit their own member record.
 * Accepts memberId to identify the Redis member, then verifies ownership
 * via userId match or claims the record if userId is unset.
 */
const updateOwnMember = async (
  teamId: string,
  memberId: string,
  updates: Partial<
    Pick<TeamMember, "name" | "title" | "timezone" | "workingHoursStart" | "workingHoursEnd">
  >,
): Promise<ActionResult<Team>> => {
  try {
    const session = await requireAuth();

    const teamUuidResult = UUIDSchema.safeParse(teamId);
    if (!teamUuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const memberUuidResult = UUIDSchema.safeParse(memberId);
    if (!memberUuidResult.success) {
      return { success: false, error: "Invalid member ID" };
    }

    // Verify the user has a Postgres membership for this team
    const membership = await prisma.membership.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId } },
    });
    if (!membership) {
      return { success: false, error: "You are not a member of this team" };
    }

    const updateResult = TeamMemberUpdateSchema.safeParse(updates);
    if (!updateResult.success) {
      const errorMessage = updateResult.error.issues[0]?.message ?? "Invalid update data";
      return { success: false, error: errorMessage };
    }

    // Strip groupId to prevent self-assignment to groups
    const { groupId: _stripped, ...safeUpdates } = updateResult.data;

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const memberIndex = team.members.findIndex((m) => m.id === memberId);
    if (memberIndex === -1) {
      return { success: false, error: "Member not found" };
    }

    const member = team.members[memberIndex];

    // Verify ownership: userId must match or be unset (claim the record)
    if (member.userId && member.userId !== session.user.id) {
      return { success: false, error: "You can only edit your own member record" };
    }

    const updatedMember = {
      ...member,
      ...safeUpdates,
      userId: session.user.id,
    };

    team.members[memberIndex] = updatedMember;

    await Promise.all([
      redis.set(`team:${teamId}`, JSON.stringify(team), {
        ex: TEAM_ACTIVE_TTL_SECONDS,
      }),
      realtime.channel(`team-${teamId}`).emit("team.memberUpdated", updatedMember),
    ]);

    return { success: true, data: sanitizeTeam(team, session.user.id) };
  } catch (error) {
    console.error("Failed to update own member:", error);
    return { success: false, error: "Failed to update member" };
  }
};

const reorderMembers = async (
  teamId: string,
  memberIds: Array<string>,
): Promise<ActionResult<void>> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    await requireTeamAdmin(teamId);

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const existingIds = new Set(team.members.map((m) => m.id));
    const inputIds = new Set(memberIds);
    if (inputIds.size !== existingIds.size || !memberIds.every((id) => existingIds.has(id))) {
      return { success: false, error: "Invalid member order" };
    }

    const memberMap = new Map(team.members.map((m) => [m.id, m]));
    team.members = memberIds.map((id, index) => ({
      ...memberMap.get(id)!,
      order: index,
    }));

    await Promise.all([
      redis.set(`team:${teamId}`, JSON.stringify(team), {
        ex: TEAM_ACTIVE_TTL_SECONDS,
      }),
      realtime.channel(`team-${teamId}`).emit("team.membersReordered", {
        order: memberIds,
      }),
    ]);

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Failed to reorder members:", error);
    return { success: false, error: "Failed to reorder members" };
  }
};

export {
  addMember,
  importMembers,
  removeMember,
  reorderMembers,
  updateMember,
  updateOwnMember,
  updateTeamName,
};
