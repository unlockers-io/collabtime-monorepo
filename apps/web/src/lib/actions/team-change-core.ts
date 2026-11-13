import type { authorizeTeamAdmin, authorizeTeamMember, TeamAccess } from "@/lib/team-auth";
import type { AccessChange, ApplyTeamCommand } from "@/lib/team-store";

import { displayName } from "../display-name";
import {
  isTeamChangeName,
  parseTeamChange,
  type TeamChangeArgs,
  type TeamChangeName,
  type TeamChangeParts,
  type TeamChangeReply,
  teamChanges,
} from "../team-changes";

import type { ActionErrorEvent, ActionResult } from "./types";

type AccessChanges<TTransaction> = {
  [TName in TeamChangeName]?: (
    access: TeamAccess,
  ) => AccessChange<TeamChangeParts[TName]["value"], TTransaction>;
};

type TeamChangeDeps<TTransaction> = {
  accessChanges: AccessChanges<TTransaction>;
  applyTeamCommand: ApplyTeamCommand<TTransaction>;
  authorizeTeamAdmin: typeof authorizeTeamAdmin;
  authorizeTeamMember: typeof authorizeTeamMember;
  reportError: (event: ActionErrorEvent) => void;
};

const createTeamChangeAction = <TTransaction>(deps: TeamChangeDeps<TTransaction>) => {
  return async <TName extends TeamChangeName>(
    teamId: string,
    name: TName,
    args: TeamChangeArgs<TName>,
  ): Promise<ActionResult<TeamChangeReply<TName>>> => {
    if (!isTeamChangeName(name)) {
      return { error: "Unknown change", success: false };
    }

    const change = teamChanges[name];

    const access = await (change.role === "ADMIN"
      ? deps.authorizeTeamAdmin(teamId)
      : deps.authorizeTeamMember(teamId));

    if (!access.success) {
      return access;
    }

    const parsed = parseTeamChange(name, args);

    if (!parsed.ok) {
      return { error: parsed.error, success: false };
    }

    const { user } = access.data;
    const actor = { id: user.id, name: displayName(user.name, user.email) };

    try {
      const applied = await deps.applyTeamCommand(
        access.data.teamId,
        change.command(parsed.args, actor),
        deps.accessChanges[name]?.(access.data),
      );

      return applied.ok
        ? { data: change.reply(applied.value), success: true }
        : { error: applied.error, success: false };
    } catch (error) {
      const message = `Failed to ${change.failure}`;
      deps.reportError({
        error,
        message,
        route: "actions/team-change",
        teamId: access.data.teamId,
      });

      return { error: message, success: false };
    }
  };
};

export { createTeamChangeAction };
