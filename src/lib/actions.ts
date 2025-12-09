"use server";

import { v4 as uuidv4 } from "uuid";
import { redis, TEAM_INITIAL_TTL_SECONDS, TEAM_ACTIVE_TTL_SECONDS } from "./redis";
import { realtime } from "./realtime";
import {
  TeamGroupInputSchema,
  TeamGroupUpdateSchema,
  TeamMemberInputSchema,
  TeamMemberUpdateSchema,
  UUIDSchema,
} from "./validation";
import type { Team, TeamGroup, TeamMember } from "@/types";
import z from "zod";

type ActionResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};

const createTeam = async (): Promise<ActionResult<string>> => {
  try {
    const teamId = uuidv4();
    const team: Team = {
      id: teamId,
      name: "",
      createdAt: new Date().toISOString(),
      members: [],
      groups: [],
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

const getTeam = async (teamId: string): Promise<Team | null> => {
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

    return team;
  } catch (error) {
    console.error("Failed to get team:", error);
    return null;
  }
};

const addMember = async (
  teamId: string,
  member: Omit<TeamMember, "id">
): Promise<ActionResult<{ team: Team; member: TeamMember }>> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const memberResult = TeamMemberInputSchema.safeParse(member);
    if (!memberResult.success) {
      const errorMessage = memberResult.error.issues[0]?.message ?? "Invalid member data";
      return { success: false, error: errorMessage };
    }

    const team = await getTeam(teamId);

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

    return { success: true, data: { team, member: newMember } };
  } catch (error) {
    console.error("Failed to add member:", error);
    return { success: false, error: "Failed to add member" };
  }
};

const removeMember = async (
  teamId: string,
  memberId: string
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

    const team = await getTeam(teamId);

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

    return { success: true, data: team };
  } catch (error) {
    console.error("Failed to remove member:", error);
    return { success: false, error: "Failed to remove member" };
  }
};

const updateMember = async (
  teamId: string,
  memberId: string,
  updates: Partial<Omit<TeamMember, "id">>
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

    const team = await getTeam(teamId);

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

    return { success: true, data: team };
  } catch (error) {
    console.error("Failed to update member:", error);
    return { success: false, error: "Failed to update member" };
  }
};

const reorderMembers = async (
  teamId: string,
  orderedIds: string[]
): Promise<ActionResult<Team>> => {
  try {
    const teamUuidResult = UUIDSchema.safeParse(teamId);
    if (!teamUuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const idsResult = z.array(UUIDSchema).safeParse(orderedIds);
    if (!idsResult.success) {
      return { success: false, error: "Invalid member IDs" };
    }

    const team = await getTeam(teamId);
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

    return { success: true, data: team };
  } catch (error) {
    console.error("Failed to reorder members:", error);
    return { success: false, error: "Failed to reorder members" };
  }
};

const updateTeamName = async (
  teamId: string,
  name: string
): Promise<ActionResult<Team>> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const trimmedName = name.trim().slice(0, 100);

    const team = await getTeam(teamId);
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

    return { success: true, data: team };
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
  input: { name: string }
): Promise<ActionResult<{ team: Team; group: TeamGroup }>> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const inputResult = TeamGroupInputSchema.safeParse(input);
    if (!inputResult.success) {
      const errorMessage = inputResult.error.issues[0]?.message ?? "Invalid group data";
      return { success: false, error: errorMessage };
    }

    const team = await getTeam(teamId);
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

    return { success: true, data: { team, group: newGroup } };
  } catch (error) {
    console.error("Failed to create group:", error);
    return { success: false, error: "Failed to create group" };
  }
};

const updateGroup = async (
  teamId: string,
  groupId: string,
  updates: Partial<{ name: string }>
): Promise<ActionResult<Team>> => {
  try {
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

    const team = await getTeam(teamId);
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

    return { success: true, data: team };
  } catch (error) {
    console.error("Failed to update group:", error);
    return { success: false, error: "Failed to update group" };
  }
};

const removeGroup = async (
  teamId: string,
  groupId: string
): Promise<ActionResult<Team>> => {
  try {
    const teamUuidResult = UUIDSchema.safeParse(teamId);
    const groupUuidResult = UUIDSchema.safeParse(groupId);

    if (!teamUuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }
    if (!groupUuidResult.success) {
      return { success: false, error: "Invalid group ID" };
    }

    const team = await getTeam(teamId);
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

    return { success: true, data: team };
  } catch (error) {
    console.error("Failed to remove group:", error);
    return { success: false, error: "Failed to remove group" };
  }
};

const reorderGroups = async (
  teamId: string,
  orderedIds: string[]
): Promise<ActionResult<Team>> => {
  try {
    const teamUuidResult = UUIDSchema.safeParse(teamId);
    if (!teamUuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const idsResult = z.array(UUIDSchema).safeParse(orderedIds);
    if (!idsResult.success) {
      return { success: false, error: "Invalid group IDs" };
    }

    const team = await getTeam(teamId);
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

    return { success: true, data: team };
  } catch (error) {
    console.error("Failed to reorder groups:", error);
    return { success: false, error: "Failed to reorder groups" };
  }
};

export {
  createGroup,
  createTeam,
  getTeam,
  addMember,
  removeGroup,
  removeMember,
  reorderGroups,
  reorderMembers,
  updateGroup,
  updateMember,
  updateTeamName,
  validateTeam,
};
