import type { authorizeTeamAdmin } from "@/lib/team-auth";
import type { Team, TeamGroup } from "@/types";

import { teamCommands } from "../team-commands";
import { TeamGroupInputSchema, TeamGroupUpdateSchema } from "../validation";

import { invalidUuid, parsedInput, sanitizedTeam, sanitizeTeam } from "./helpers";
import type { MutateTeam } from "./helpers";
import type { ActionResult } from "./types";

type GroupActionDeps = {
  authorizeTeamAdmin: typeof authorizeTeamAdmin;
  mutateTeam: MutateTeam;
};

const createGroupActions = (deps: GroupActionDeps) => {
  const createGroup = async (
    teamId: string,
    input: { name: string },
  ): Promise<ActionResult<{ group: TeamGroup; team: Team }>> => {
    const access = await deps.authorizeTeamAdmin(teamId);
    if (!access.success) {
      return access;
    }
    const parsed = parsedInput(TeamGroupInputSchema.safeParse(input), "Invalid group data");
    if (!parsed.success) {
      return parsed;
    }
    const created = await deps.mutateTeam({
      access: access.data,
      command: teamCommands.addGroup(parsed.data.name),
      errorContext: "create group",
    });
    return created.success
      ? {
          data: { group: created.data.value, team: sanitizeTeam(created.data.team) },
          success: true,
        }
      : created;
  };

  const updateGroup = async (
    teamId: string,
    groupId: string,
    updates: Partial<{ name: string }>,
  ): Promise<ActionResult<Team>> => {
    const access = await deps.authorizeTeamAdmin(teamId);
    if (!access.success) {
      return access;
    }
    const invalid = invalidUuid(groupId, "group ID");
    if (invalid) {
      return invalid;
    }
    const parsed = parsedInput(TeamGroupUpdateSchema.safeParse(updates), "Invalid update data");
    if (!parsed.success) {
      return parsed;
    }
    return sanitizedTeam(
      await deps.mutateTeam({
        access: access.data,
        command: teamCommands.updateGroup(groupId, parsed.data),
        errorContext: "update group",
      }),
    );
  };

  const removeGroup = async (teamId: string, groupId: string): Promise<ActionResult<Team>> => {
    const access = await deps.authorizeTeamAdmin(teamId);
    if (!access.success) {
      return access;
    }
    const invalid = invalidUuid(groupId, "group ID");
    if (invalid) {
      return invalid;
    }
    return sanitizedTeam(
      await deps.mutateTeam({
        access: access.data,
        command: teamCommands.removeGroup(groupId),
        errorContext: "remove group",
      }),
    );
  };

  const reorderGroups = async (
    teamId: string,
    groupIds: Array<string>,
  ): Promise<ActionResult<void>> => {
    const access = await deps.authorizeTeamAdmin(teamId);
    if (!access.success) {
      return access;
    }
    const reordered = await deps.mutateTeam({
      access: access.data,
      command: teamCommands.reorderGroups(groupIds),
      errorContext: "reorder groups",
    });
    return reordered.success ? { data: undefined, success: true } : reordered;
  };

  return { createGroup, removeGroup, reorderGroups, updateGroup };
};

export { createGroupActions };
