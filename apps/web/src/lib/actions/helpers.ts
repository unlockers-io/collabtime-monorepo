import { log } from "@/lib/observability";
import { requireTeamAdmin } from "@/lib/team-auth";
import type { Team, TeamRecord } from "@/types";

import { applyTeamContents } from "../team-store";
import { UUIDSchema } from "../validation";

import type { ActionResult } from "./types";

const sanitizeMemberUserId = (
  userId: string | undefined,
  currentUserId: string | undefined,
): { userId: string } | Record<string, never> => {
  if (userId === currentUserId) {
    return userId === undefined ? {} : { userId };
  }
  if (userId !== undefined && userId !== "") {
    return { userId: "claimed" };
  }
  return {};
};

const sanitizeTeam = (team: TeamRecord, currentUserId?: string): Team => {
  const { adminPasswordHash: _, ...publicTeam } = team;
  return {
    ...publicTeam,
    members: publicTeam.members.map(({ userId, ...member }) =>
      Object.assign(member, sanitizeMemberUserId(userId, currentUserId)),
    ),
  };
};

type MutationOutcome<TResult> = { error: string; ok: false } | { ok: true; value: TResult };

type MutateTeamArgs<TPrelude, TResult> = {
  authorize?: (teamId: string) => Promise<MutationOutcome<void>>;
  errorContext: string;
  mutate: (team: TeamRecord, prelude: TPrelude) => MutationOutcome<TResult>;
  prelude: () => MutationOutcome<TPrelude> | Promise<MutationOutcome<TPrelude>>;
  teamId: string;
};

type TeamMutatorDeps = {
  applyTeamContents: typeof applyTeamContents;
  reportError: (event: Record<string, unknown>) => void;
  requireTeamAdmin: typeof requireTeamAdmin;
};

type MutateTeam = <TPrelude, TResult>(
  args: MutateTeamArgs<TPrelude, TResult>,
) => Promise<ActionResult<TResult>>;

const createTeamMutator = (deps: TeamMutatorDeps): MutateTeam =>
  async function mutateTeam<TPrelude, TResult>(args: MutateTeamArgs<TPrelude, TResult>) {
    const { authorize, errorContext, mutate, prelude, teamId } = args;
    try {
      const uuidResult = UUIDSchema.safeParse(teamId);
      if (!uuidResult.success) {
        return { error: "Invalid team ID", success: false };
      }

      if (authorize) {
        const authorizeOutcome = await authorize(teamId);
        if (!authorizeOutcome.ok) {
          return { error: authorizeOutcome.error, success: false };
        }
      } else {
        await deps.requireTeamAdmin(teamId);
      }

      const preludeOutcome = await prelude();
      if (!preludeOutcome.ok) {
        return { error: preludeOutcome.error, success: false };
      }

      /**
       * Delegated rather than re-run through readTeamRecord + writeTeamRecord:
       * readTeamRecord flattens "could not read the store" into the same `null` as
       * "this team has no contents", which reported a Redis outage to the user as
       * "Team not found". applyTeamContents keeps those apart via `reason`.
       */
      const applied = await deps.applyTeamContents(teamId, (team) => {
        if (team === null) {
          return { error: "Team not found", ok: false };
        }

        const outcome = mutate(team, preludeOutcome.value);
        return outcome.ok ? { ok: true, team, value: outcome.value } : outcome;
      });

      if (!applied.ok) {
        return {
          error: applied.reason === "write-failed" ? `Failed to ${errorContext}` : applied.error,
          success: false,
        };
      }

      return { data: applied.value, success: true };
    } catch (error) {
      deps.reportError({ error, message: `Failed to ${errorContext}`, route: "actions/helpers" });
      return { error: `Failed to ${errorContext}`, success: false };
    }
  };

const mutateTeam = createTeamMutator({
  applyTeamContents,
  reportError: log.error,
  requireTeamAdmin,
});

const checkUuid = (value: string, label: string): MutationOutcome<void> => {
  const result = UUIDSchema.safeParse(value);
  if (!result.success) {
    return { error: `Invalid ${label}`, ok: false };
  }
  return { ok: true, value: undefined };
};

export { checkUuid, createTeamMutator, mutateTeam, sanitizeTeam };
export type { MutateTeam, TeamMutatorDeps };
