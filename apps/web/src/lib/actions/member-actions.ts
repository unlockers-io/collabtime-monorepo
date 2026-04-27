"use server";

// oxlint-disable no-console -- server action diagnostic logging; TODO migrate to structured logger
import { prisma } from "@repo/db";
import { v4 as uuidv4 } from "uuid";

import { requireAuth, requireTeamAdmin } from "@/lib/team-auth";
import type { Team, TeamMember } from "@/types";

import { realtime } from "../realtime";
import { TeamMemberInputSchema, TeamMemberUpdateSchema, UUIDSchema } from "../validation";

import { getTeamRecord, persistTeam, sanitizeTeam } from "./helpers";
import type { ActionResult } from "./types";

const addMember = async (
  teamId: string,
  member: Omit<TeamMember, "id" | "order">,
): Promise<ActionResult<{ member: TeamMember; team: Team }>> => {
  try {
    const memberResult = TeamMemberInputSchema.safeParse(member);
    if (!memberResult.success) {
      const errorMessage = memberResult.error.issues[0]?.message ?? "Invalid member data";
      return { error: errorMessage, success: false };
    }

    await requireTeamAdmin(teamId);

    const team = await getTeamRecord(teamId);

    if (!team) {
      return { error: "Team not found", success: false };
    }

    const newMember: TeamMember = {
      ...memberResult.data,
      id: uuidv4(),
      order: team.members.length,
    };

    team.members.push(newMember);

    await Promise.all([
      persistTeam(teamId, team),
      realtime.channel(`team-${teamId}`).emit("team.memberAdded", newMember),
    ]);

    return {
      data: { member: newMember, team: sanitizeTeam(team) },
      success: true,
    };
  } catch (error) {
    console.error("Failed to add member:", error);
    return { error: "Failed to add member", success: false };
  }
};

const removeMember = async (teamId: string, memberId: string): Promise<ActionResult<Team>> => {
  try {
    const teamUuidResult = UUIDSchema.safeParse(teamId);
    const memberUuidResult = UUIDSchema.safeParse(memberId);

    if (!teamUuidResult.success) {
      return { error: "Invalid team ID", success: false };
    }
    if (!memberUuidResult.success) {
      return { error: "Invalid member ID", success: false };
    }

    await requireTeamAdmin(teamId);

    const team = await getTeamRecord(teamId);

    if (!team) {
      return { error: "Team not found", success: false };
    }

    const memberExists = team.members.some((m) => m.id === memberId);
    if (!memberExists) {
      return { error: "Member not found", success: false };
    }

    team.members = team.members.filter((m) => m.id !== memberId);

    await Promise.all([
      persistTeam(teamId, team),
      realtime.channel(`team-${teamId}`).emit("team.memberRemoved", { memberId }),
    ]);

    return { data: sanitizeTeam(team), success: true };
  } catch (error) {
    console.error("Failed to remove member:", error);
    return { error: "Failed to remove member", success: false };
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
      return { error: "Invalid team ID", success: false };
    }
    if (!memberUuidResult.success) {
      return { error: "Invalid member ID", success: false };
    }

    const updateResult = TeamMemberUpdateSchema.safeParse(updates);
    if (!updateResult.success) {
      const errorMessage = updateResult.error.issues[0]?.message ?? "Invalid update data";
      return { error: errorMessage, success: false };
    }

    await requireTeamAdmin(teamId);

    const team = await getTeamRecord(teamId);

    if (!team) {
      return { error: "Team not found", success: false };
    }

    const memberIndex = team.members.findIndex((m) => m.id === memberId);

    if (memberIndex === -1) {
      return { error: "Member not found", success: false };
    }

    const updatedMember = {
      ...team.members[memberIndex],
      ...updateResult.data,
    };

    team.members[memberIndex] = updatedMember;

    await Promise.all([
      persistTeam(teamId, team),
      realtime.channel(`team-${teamId}`).emit("team.memberUpdated", updatedMember),
    ]);

    return { data: sanitizeTeam(team), success: true };
  } catch (error) {
    console.error("Failed to update member:", error);
    return { error: "Failed to update member", success: false };
  }
};

const updateTeamName = async (teamId: string, name: string): Promise<ActionResult<Team>> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { error: "Invalid team ID", success: false };
    }

    const trimmedName = name.trim().slice(0, 100);
    if (!trimmedName) {
      return { error: "Team name cannot be empty", success: false };
    }

    await requireTeamAdmin(teamId);

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { error: "Team not found", success: false };
    }

    team.name = trimmedName;

    await Promise.all([
      persistTeam(teamId, team),
      realtime.channel(`team-${teamId}`).emit("team.nameUpdated", {
        name: trimmedName,
      }),
    ]);

    return { data: sanitizeTeam(team), success: true };
  } catch (error) {
    console.error("Failed to update team name:", error);
    return { error: "Failed to update team name", success: false };
  }
};

const importMembers = async (
  teamId: string,
  members: Array<Omit<TeamMember, "id" | "order">>,
): Promise<ActionResult<{ imported: number; members: Array<TeamMember>; team: Team }>> => {
  try {
    if (!Array.isArray(members) || members.length === 0) {
      return { error: "No members to import", success: false };
    }

    if (members.length > 100) {
      return { error: "Cannot import more than 100 members at once", success: false };
    }

    const validated: Array<TeamMember> = [];
    for (const member of members) {
      const result = TeamMemberInputSchema.safeParse(member);
      if (!result.success) {
        const msg = result.error.issues[0]?.message ?? "Invalid member data";
        return { error: `Invalid member "${member.name}": ${msg}`, success: false };
      }
      validated.push({ ...result.data, id: uuidv4(), order: 0 });
    }

    await requireTeamAdmin(teamId);

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { error: "Team not found", success: false };
    }

    const startOrder = team.members.length;
    const orderedValidated = validated.map((m, i) => ({ ...m, order: startOrder + i }));
    team.members.push(...orderedValidated);

    await Promise.all([
      persistTeam(teamId, team),
      realtime.channel(`team-${teamId}`).emit("team.membersImported", validated),
    ]);

    return {
      data: { imported: validated.length, members: validated, team: sanitizeTeam(team) },
      success: true,
    };
  } catch (error) {
    console.error("Failed to import members:", error);
    return { error: "Failed to import members", success: false };
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
      return { error: "Invalid team ID", success: false };
    }

    const memberUuidResult = UUIDSchema.safeParse(memberId);
    if (!memberUuidResult.success) {
      return { error: "Invalid member ID", success: false };
    }

    // Verify the user has a Postgres membership for this team
    const membership = await prisma.membership.findUnique({
      where: { userId_teamId: { teamId, userId: session.user.id } },
    });
    if (!membership) {
      return { error: "You are not a member of this team", success: false };
    }

    const updateResult = TeamMemberUpdateSchema.safeParse(updates);
    if (!updateResult.success) {
      const errorMessage = updateResult.error.issues[0]?.message ?? "Invalid update data";
      return { error: errorMessage, success: false };
    }

    // Strip groupId to prevent self-assignment to groups
    const { groupId: _stripped, ...safeUpdates } = updateResult.data;

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { error: "Team not found", success: false };
    }

    const memberIndex = team.members.findIndex((m) => m.id === memberId);
    if (memberIndex === -1) {
      return { error: "Member not found", success: false };
    }

    const member = team.members[memberIndex];

    // Verify ownership: userId must match or be unset (claim the record)
    if (member.userId && member.userId !== session.user.id) {
      return { error: "You can only edit your own member record", success: false };
    }

    const updatedMember = {
      ...member,
      ...safeUpdates,
      userId: session.user.id,
    };

    team.members[memberIndex] = updatedMember;

    await Promise.all([
      persistTeam(teamId, team),
      realtime.channel(`team-${teamId}`).emit("team.memberUpdated", updatedMember),
    ]);

    return { data: sanitizeTeam(team, session.user.id), success: true };
  } catch (error) {
    console.error("Failed to update own member:", error);
    return { error: "Failed to update member", success: false };
  }
};

const reorderMembers = async (
  teamId: string,
  memberIds: Array<string>,
): Promise<ActionResult<void>> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { error: "Invalid team ID", success: false };
    }

    await requireTeamAdmin(teamId);

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { error: "Team not found", success: false };
    }

    const existingIds = new Set(team.members.map((m) => m.id));
    const inputIds = new Set(memberIds);
    if (inputIds.size !== existingIds.size || !memberIds.every((id) => existingIds.has(id))) {
      return { error: "Invalid member order", success: false };
    }

    const memberMap = new Map(team.members.map((m) => [m.id, m]));
    const reorderedMembers = memberIds.flatMap((id, index) => {
      const member = memberMap.get(id);
      return member ? [{ ...member, order: index }] : [];
    });
    team.members = reorderedMembers;

    await Promise.all([
      persistTeam(teamId, team),
      realtime.channel(`team-${teamId}`).emit("team.membersReordered", {
        order: memberIds,
      }),
    ]);

    return { data: undefined, success: true };
  } catch (error) {
    console.error("Failed to reorder members:", error);
    return { error: "Failed to reorder members", success: false };
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
