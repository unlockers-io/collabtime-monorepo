"use server";

import { v4 as uuidv4 } from "uuid";

import { requireTeamAdmin } from "@/lib/team-auth";
import type { Team, TeamGroup } from "@/types";

import { realtime } from "../realtime";
import { TeamGroupInputSchema, TeamGroupUpdateSchema, UUIDSchema } from "../validation";

import { getTeamRecord, persistTeam, sanitizeTeam } from "./helpers";
import type { ActionResult } from "./types";

const createGroup = async (
  teamId: string,
  input: { name: string },
): Promise<ActionResult<{ group: TeamGroup; team: Team }>> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { error: "Invalid team ID", success: false };
    }

    const inputResult = TeamGroupInputSchema.safeParse(input);
    if (!inputResult.success) {
      const errorMessage = inputResult.error.issues[0]?.message ?? "Invalid group data";
      return { error: errorMessage, success: false };
    }

    await requireTeamAdmin(teamId);

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { error: "Team not found", success: false };
    }

    const newGroup: TeamGroup = {
      id: uuidv4(),
      name: inputResult.data.name,
      order: team.groups.length,
    };

    team.groups.push(newGroup);

    await Promise.all([
      persistTeam(teamId, team),
      realtime.channel(`team-${teamId}`).emit("team.groupCreated", newGroup),
    ]);

    return {
      data: { group: newGroup, team: sanitizeTeam(team) },
      success: true,
    };
  } catch (error) {
    console.error("Failed to create group:", error);
    return { error: "Failed to create group", success: false };
  }
};

const updateGroup = async (
  teamId: string,
  groupId: string,
  updates: Partial<{ name: string }>,
): Promise<ActionResult<Team>> => {
  try {
    const teamUuidResult = UUIDSchema.safeParse(teamId);
    const groupUuidResult = UUIDSchema.safeParse(groupId);

    if (!teamUuidResult.success) {
      return { error: "Invalid team ID", success: false };
    }
    if (!groupUuidResult.success) {
      return { error: "Invalid group ID", success: false };
    }

    const updateResult = TeamGroupUpdateSchema.safeParse(updates);
    if (!updateResult.success) {
      const errorMessage = updateResult.error.issues[0]?.message ?? "Invalid update data";
      return { error: errorMessage, success: false };
    }

    await requireTeamAdmin(teamId);

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { error: "Team not found", success: false };
    }

    const groupIndex = team.groups.findIndex((g) => g.id === groupId);
    if (groupIndex === -1) {
      return { error: "Group not found", success: false };
    }

    const updatedGroup = {
      ...team.groups[groupIndex],
      ...updateResult.data,
    };

    team.groups[groupIndex] = updatedGroup;

    await Promise.all([
      persistTeam(teamId, team),
      realtime.channel(`team-${teamId}`).emit("team.groupUpdated", updatedGroup),
    ]);

    return { data: sanitizeTeam(team), success: true };
  } catch (error) {
    console.error("Failed to update group:", error);
    return { error: "Failed to update group", success: false };
  }
};

const removeGroup = async (teamId: string, groupId: string): Promise<ActionResult<Team>> => {
  try {
    const teamUuidResult = UUIDSchema.safeParse(teamId);
    const groupUuidResult = UUIDSchema.safeParse(groupId);

    if (!teamUuidResult.success) {
      return { error: "Invalid team ID", success: false };
    }
    if (!groupUuidResult.success) {
      return { error: "Invalid group ID", success: false };
    }

    await requireTeamAdmin(teamId);

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { error: "Team not found", success: false };
    }

    const groupExists = team.groups.some((g) => g.id === groupId);
    if (!groupExists) {
      return { error: "Group not found", success: false };
    }

    team.groups = team.groups.filter((g) => g.id !== groupId);

    // Unassign all members from this group
    team.members = team.members.map((m) =>
      m.groupId === groupId ? { ...m, groupId: undefined } : m,
    );

    // Update order values for remaining groups
    team.groups = team.groups.map((g, index) => ({ ...g, order: index }));

    await Promise.all([
      persistTeam(teamId, team),
      realtime.channel(`team-${teamId}`).emit("team.groupRemoved", { groupId }),
    ]);

    return { data: sanitizeTeam(team), success: true };
  } catch (error) {
    console.error("Failed to remove group:", error);
    return { error: "Failed to remove group", success: false };
  }
};

const reorderGroups = async (
  teamId: string,
  groupIds: Array<string>,
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

    const existingIds = new Set(team.groups.map((g) => g.id));
    const inputIds = new Set(groupIds);
    if (inputIds.size !== existingIds.size || !groupIds.every((id) => existingIds.has(id))) {
      return { error: "Invalid group order", success: false };
    }

    const groupMap = new Map(team.groups.map((g) => [g.id, g]));
    const reorderedGroups = groupIds.flatMap((id, index) => {
      const group = groupMap.get(id);
      return group ? [{ ...group, order: index }] : [];
    });
    team.groups = reorderedGroups;

    await Promise.all([
      persistTeam(teamId, team),
      realtime.channel(`team-${teamId}`).emit("team.groupsReordered", {
        order: groupIds,
      }),
    ]);

    return { data: undefined, success: true };
  } catch (error) {
    console.error("Failed to reorder groups:", error);
    return { error: "Failed to reorder groups", success: false };
  }
};

export { createGroup, removeGroup, reorderGroups, updateGroup };
