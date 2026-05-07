"use server";

import { v4 as uuidv4 } from "uuid";

import type { Team, TeamGroup } from "@/types";

import { TeamGroupInputSchema, TeamGroupUpdateSchema } from "../validation";

import { checkUuid, mutateTeam, sanitizeTeam } from "./helpers";
import type { ActionResult } from "./types";

const createGroup = (
  teamId: string,
  input: { name: string },
): Promise<ActionResult<{ group: TeamGroup; team: Team }>> => {
  return mutateTeam({
    errorContext: "create group",
    mutate: (team, parsed) => {
      const newGroup: TeamGroup = {
        id: uuidv4(),
        name: parsed.name,
        order: team.groups.length,
      };
      team.groups.push(newGroup);
      return { ok: true, value: { group: newGroup, team: sanitizeTeam(team) } };
    },
    prelude: () => {
      const result = TeamGroupInputSchema.safeParse(input);
      if (!result.success) {
        return { error: result.error.issues[0]?.message ?? "Invalid group data", ok: false };
      }
      return { ok: true, value: result.data };
    },
    teamId,
  });
};

const updateGroup = (
  teamId: string,
  groupId: string,
  updates: Partial<{ name: string }>,
): Promise<ActionResult<Team>> => {
  return mutateTeam({
    errorContext: "update group",
    mutate: (team, parsed) => {
      const groupIndex = team.groups.findIndex((g) => g.id === groupId);
      if (groupIndex === -1) {
        return { error: "Group not found", ok: false };
      }
      team.groups[groupIndex] = { ...team.groups[groupIndex], ...parsed };
      return { ok: true, value: sanitizeTeam(team) };
    },
    prelude: () => {
      const idCheck = checkUuid(groupId, "group ID");
      if (!idCheck.ok) {
        return idCheck;
      }
      const result = TeamGroupUpdateSchema.safeParse(updates);
      if (!result.success) {
        return { error: result.error.issues[0]?.message ?? "Invalid update data", ok: false };
      }
      return { ok: true, value: result.data };
    },
    teamId,
  });
};

const removeGroup = (teamId: string, groupId: string): Promise<ActionResult<Team>> => {
  return mutateTeam({
    errorContext: "remove group",
    mutate: (team) => {
      if (!team.groups.some((g) => g.id === groupId)) {
        return { error: "Group not found", ok: false };
      }
      team.groups = team.groups.filter((g) => g.id !== groupId);
      team.groups = team.groups.map((g, index) => ({ ...g, order: index }));
      // Unassign all members from the removed group.
      team.members = team.members.map((m) =>
        m.groupId === groupId ? { ...m, groupId: undefined } : m,
      );
      return { ok: true, value: sanitizeTeam(team) };
    },
    prelude: () => checkUuid(groupId, "group ID"),
    teamId,
  });
};

const reorderGroups = (teamId: string, groupIds: Array<string>): Promise<ActionResult<void>> => {
  return mutateTeam({
    errorContext: "reorder groups",
    mutate: (team) => {
      const existingIds = new Set(team.groups.map((g) => g.id));
      const inputIds = new Set(groupIds);
      if (inputIds.size !== existingIds.size || !groupIds.every((id) => existingIds.has(id))) {
        return { error: "Invalid group order", ok: false };
      }
      const groupMap = new Map(team.groups.map((g) => [g.id, g]));
      team.groups = groupIds.flatMap((id, index) => {
        const group = groupMap.get(id);
        return group ? [{ ...group, order: index }] : [];
      });
      return { ok: true, value: undefined };
    },
    teamId,
  });
};

export { createGroup, removeGroup, reorderGroups, updateGroup };
