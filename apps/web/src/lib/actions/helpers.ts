import { log } from "@/lib/observability";
import { requireTeamAdmin } from "@/lib/team-auth";
import type { Team, TeamRecord } from "@/types";

import { redis, TEAM_ACTIVE_TTL_SECONDS } from "../redis";
import { UUIDSchema } from "../validation";

import type { ActionResult } from "./types";

const sanitizeMemberUserId = (
  userId: string | undefined,
  currentUserId: string | undefined,
): { userId: string } | Record<string, never> => {
  if (userId === currentUserId) {
    return userId === undefined ? {} : { userId };
  }
  if (userId) {
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

const getTeamRecord = async (teamId: string): Promise<TeamRecord | null> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return null;
    }

    const data = await redis.get(`team:${teamId}`);

    if (!data) {
      return null;
    }

    const team = JSON.parse(data) as TeamRecord;

    if (!team.groups) {
      team.groups = [];
    }
    if (!team.members) {
      team.members = [];
    }

    // Backfill order for members that lack it
    team.members = team.members.map((m, i) => ({ ...m, order: m.order ?? i }));

    return team;
  } catch (error) {
    log.error({ error, message: "Failed to get team", route: "actions/helpers" });
    return null;
  }
};

const persistTeam = async (teamId: string, team: TeamRecord): Promise<void> => {
  await redis.set(`team:${teamId}`, JSON.stringify(team), "EX", TEAM_ACTIVE_TTL_SECONDS);
};

type MutationOutcome<TResult> = { error: string; ok: false } | { ok: true; value: TResult };

type MutateTeamArgs<TPrelude, TResult> = {
  // Logged on thrown errors and used as the user-facing fallback ("Failed to <errorContext>").
  errorContext: string;
  mutate: (team: TeamRecord, prelude: TPrelude) => MutationOutcome<TResult>;
  // Validates secondary IDs and payloads, returning a parsed object for the mutator.
  // Return `{ ok: false, error }` to short-circuit; `{ ok: true, value }` to proceed.
  // Runs before auth + team load. May be async (e.g. for Postgres membership lookups).
  prelude?: () => MutationOutcome<TPrelude> | Promise<MutationOutcome<TPrelude>>;
  // Skip the default `requireTeamAdmin` check (caller has done a custom one).
  skipAdminCheck?: boolean;
  teamId: string;
};

/**
 * The canonical "validate → auth → load → mutate → persist" pipeline for team-record
 * server actions. Concentrates UUID validation, admin auth, Redis I/O, the "team not
 * found" branch, and the try/catch + log error envelope behind a small interface so
 * each action writes only the meaningful domain logic.
 *
 * Domain errors (member-not-found, name-empty, etc.) are returned via
 * `{ ok: false, error }` from `prelude` or `mutate`. Thrown errors fall through to the
 * catch and produce `{ error: "Failed to <errorContext>", success: false }`.
 */
const mutateTeam = async <TPrelude, TResult>(
  args: MutateTeamArgs<TPrelude, TResult>,
): Promise<ActionResult<TResult>> => {
  const { errorContext, mutate, prelude, skipAdminCheck, teamId } = args;
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { error: "Invalid team ID", success: false };
    }

    const preludeOutcome = prelude
      ? await prelude()
      : ({ ok: true, value: undefined as TPrelude } as const);
    if (!preludeOutcome.ok) {
      return { error: preludeOutcome.error, success: false };
    }

    if (!skipAdminCheck) {
      await requireTeamAdmin(teamId);
    }

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { error: "Team not found", success: false };
    }

    const outcome = mutate(team, preludeOutcome.value);
    if (!outcome.ok) {
      return { error: outcome.error, success: false };
    }

    await persistTeam(teamId, team);

    return { data: outcome.value, success: true };
  } catch (error) {
    log.error({ error, message: `Failed to ${errorContext}`, route: "actions/helpers" });
    return { error: `Failed to ${errorContext}`, success: false };
  }
};

/**
 * Validate a UUID and return a `MutationOutcome` so it composes inside `prelude`.
 */
const checkUuid = (value: string, label: string): MutationOutcome<void> => {
  const result = UUIDSchema.safeParse(value);
  if (!result.success) {
    return { error: `Invalid ${label}`, ok: false };
  }
  return { ok: true, value: undefined };
};

export { checkUuid, getTeamRecord, mutateTeam, sanitizeTeam };
