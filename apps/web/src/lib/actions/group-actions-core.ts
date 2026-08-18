import type { Team, TeamGroup } from "@/types";

import { TeamGroupInputSchema, TeamGroupUpdateSchema } from "../validation";

import { checkUuid, sanitizeTeam } from "./helpers";
import type { MutateTeam } from "./helpers";
import type { ActionResult } from "./types";

type GroupActionDeps = {
  createId: () => string;
  mutateTeam: MutateTeam;
};

const createGroupActions = (deps: GroupActionDeps) => {
  const createGroup = async (
    teamId: string,
    input: { name: string },
  ): Promise<ActionResult<{ group: TeamGroup; team: Team }>> => {
    const mutationResult = await deps.mutateTeam({
      errorContext: "create group",
      mutate: (team, parsed) => {
        const newGroup: TeamGroup = {
          id: deps.createId(),
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
    return mutationResult;
  };

  const updateGroup = async (
    teamId: string,
    groupId: string,
    updates: Partial<{ name: string }>,
  ): Promise<ActionResult<Team>> => {
    const mutationResult = await deps.mutateTeam({
      errorContext: "update group",
      mutate: (team, parsed) => {
        const groupIndex = team.groups.findIndex((group) => group.id === groupId);
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
    return mutationResult;
  };

  const removeGroup = async (teamId: string, groupId: string): Promise<ActionResult<Team>> => {
    const mutationResult = await deps.mutateTeam({
      errorContext: "remove group",
      mutate: (team) => {
        if (!team.groups.some((group) => group.id === groupId)) {
          return { error: "Group not found", ok: false };
        }
        team.groups = team.groups.filter((group) => group.id !== groupId);
        team.groups = team.groups.map((group, index) => ({ ...group, order: index }));
        team.members = team.members.map((member) =>
          member.groupId === groupId ? { ...member, groupId: undefined } : member,
        );
        return { ok: true, value: sanitizeTeam(team) };
      },
      prelude: () => checkUuid(groupId, "group ID"),
      teamId,
    });
    return mutationResult;
  };

  const reorderGroups = async (
    teamId: string,
    groupIds: Array<string>,
  ): Promise<ActionResult<void>> => {
    const mutationResult = await deps.mutateTeam({
      errorContext: "reorder groups",
      mutate: (team) => {
        const existingIds = new Set(team.groups.map((group) => group.id));
        const inputIds = new Set(groupIds);
        if (inputIds.size !== existingIds.size || !groupIds.every((id) => existingIds.has(id))) {
          return { error: "Invalid group order", ok: false };
        }
        const groupMap = new Map(team.groups.map((group) => [group.id, group]));
        team.groups = groupIds.flatMap((id, index) => {
          const group = groupMap.get(id);
          return group ? [{ ...group, order: index }] : [];
        });
        return { ok: true, value: undefined };
      },
      prelude: () => ({ ok: true, value: undefined }),
      teamId,
    });
    return mutationResult;
  };

  return { createGroup, removeGroup, reorderGroups, updateGroup };
};

export { createGroupActions };
