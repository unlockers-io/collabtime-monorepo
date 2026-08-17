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
  prelude?: () => MutationOutcome<TPrelude> | Promise<MutationOutcome<TPrelude>>;
  teamId: string;
};

const mutateTeam = async <TPrelude, TResult>(
  args: MutateTeamArgs<TPrelude, TResult>,
): Promise<ActionResult<TResult>> => {
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
      await requireTeamAdmin(teamId);
    }

    const preludeOutcome = prelude
      ? await prelude()
      : // oxlint-disable-next-line no-unsafe-type-assertion -- callers omit `prelude` only when TPrelude is undefined, so there is no runtime value to fabricate
        ({ ok: true, value: undefined as TPrelude } as const);
    if (!preludeOutcome.ok) {
      return { error: preludeOutcome.error, success: false };
    }

    /**
     * Delegated rather than re-run through readTeamRecord + writeTeamRecord:
     * readTeamRecord flattens "could not read the store" into the same `null` as
     * "this team has no contents", which reported a Redis outage to the user as
     * "Team not found". applyTeamContents keeps those apart via `reason`.
     */
    const applied = await applyTeamContents(teamId, (team) => {
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
    log.error({ error, message: `Failed to ${errorContext}`, route: "actions/helpers" });
    return { error: `Failed to ${errorContext}`, success: false };
  }
};

const checkUuid = (value: string, label: string): MutationOutcome<void> => {
  const result = UUIDSchema.safeParse(value);
  if (!result.success) {
    return { error: `Invalid ${label}`, ok: false };
  }
  return { ok: true, value: undefined };
};

export { checkUuid, mutateTeam, sanitizeTeam };
