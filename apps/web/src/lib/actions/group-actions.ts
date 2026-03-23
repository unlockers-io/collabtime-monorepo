"use server";

import { v4 as uuidv4 } from "uuid";

import { requireTeamAdmin } from "@/lib/team-auth";
import type { Team, TeamGroup } from "@/types";

import { realtime } from "../realtime";
import { redis, TEAM_ACTIVE_TTL_SECONDS } from "../redis";
import { TeamGroupInputSchema, TeamGroupUpdateSchema, UUIDSchema } from "../validation";

import { getTeamRecord, sanitizeTeam } from "./helpers";
import type { ActionResult } from "./types";

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

export { createGroup, removeGroup, updateGroup };
