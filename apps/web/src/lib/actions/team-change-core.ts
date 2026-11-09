import type { authorizeTeamAdmin, authorizeTeamMember, TeamAccess } from "@/lib/team-auth";
import type { applyTeamCommand, TeamContentsFailure } from "@/lib/team-store";

import { displayName } from "../display-name";
import type { RevokeMembership } from "../membership";
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

type TeamChangeDeps = {
  applyTeamCommand: typeof applyTeamCommand;
  authorizeTeamAdmin: typeof authorizeTeamAdmin;
  authorizeTeamMember: typeof authorizeTeamMember;
  reportError: (event: ActionErrorEvent) => void;
  revokeMembership: RevokeMembership;
};

type ServerApply<TName extends TeamChangeName> = (
  access: TeamAccess,
  args: TeamChangeParts[TName]["args"],
) => Promise<ActionResult<TeamChangeReply<TName>>>;

type ServerApplies = { [TName in TeamChangeName]?: ServerApply<TName> };

const REMOVE_FAILED = `Failed to ${teamChanges.removeMember.failure}`;

/** A rejected command keeps its reason; a failed write names the action instead. */
const failed = ({ error, reason }: TeamContentsFailure, failure: string) => ({
  error: reason === "write-failed" ? `Failed to ${failure}` : error,
  success: false as const,
});

const createTeamChangeAction = (deps: TeamChangeDeps) => {
  // Removing a member also revokes their access in the same transaction.
  const serverApply: ServerApplies = {
    removeMember: async (access, { memberId }) => {
      try {
        const revoked = await deps.revokeMembership({ access, memberId });

        if (!revoked.ok) {
          return failed(revoked, teamChanges.removeMember.failure);
        }

        return { data: undefined, success: true };
      } catch (error) {
        deps.reportError({
          error,
          memberId,
          message: REMOVE_FAILED,
          route: "actions/team-change",
          teamId: access.teamId,
        });

        return { error: REMOVE_FAILED, success: false };
      }
    },
  };

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

    const apply = serverApply[name];

    if (apply) {
      return apply(access.data, parsed.args);
    }

    const { user } = access.data;
    const actor = { id: user.id, name: displayName(user.name, user.email) };

    const applied = await deps.applyTeamCommand(
      access.data.teamId,
      change.command(parsed.args, actor),
    );

    return applied.ok
      ? { data: change.reply(applied.value), success: true }
      : failed(applied, change.failure);
  };
};

export { createTeamChangeAction };
