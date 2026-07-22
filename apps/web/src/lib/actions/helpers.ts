import { log } from "@/lib/observability";
import { requireTeamAdmin } from "@/lib/team-auth";
import type { Team, TeamGroup, TeamMember, TeamRecord } from "@/types";

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

// Legacy rows may predate `groups`, `members`, or per-member `order`.
type StoredTeamRecord = Omit<TeamRecord, "groups" | "members"> & {
  groups?: Array<TeamGroup>;
  members?: Array<Omit<TeamMember, "order"> & { order?: number }>;
};

const getTeamRecord = async (teamId: string): Promise<TeamRecord | null> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return null;
    }

    const data = await redis.get(`team:${teamId}`);

    if (data === null || data === "") {
      return null;
    }

    // oxlint-disable-next-line no-unsafe-type-assertion -- team:* keys are written only by persistTeam with a typed TeamRecord; StoredTeamRecord models the legacy gaps backfilled below
    const stored = JSON.parse(data) as StoredTeamRecord;

    return {
      ...stored,
      groups: stored.groups ?? [],
      members: (stored.members ?? []).map((m, i) => Object.assign(m, { order: m.order ?? i })),
    };
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
  errorContext: string;
  mutate: (team: TeamRecord, prelude: TPrelude) => MutationOutcome<TResult>;
  prelude?: () => MutationOutcome<TPrelude> | Promise<MutationOutcome<TPrelude>>;
  skipAdminCheck?: boolean;
  teamId: string;
};

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
      : // oxlint-disable-next-line no-unsafe-type-assertion -- callers omit `prelude` only when TPrelude is undefined, so there is no runtime value to fabricate
        ({ ok: true, value: undefined as TPrelude } as const);
    if (!preludeOutcome.ok) {
      return { error: preludeOutcome.error, success: false };
    }

    if (skipAdminCheck !== true) {
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

const checkUuid = (value: string, label: string): MutationOutcome<void> => {
  const result = UUIDSchema.safeParse(value);
  if (!result.success) {
    return { error: `Invalid ${label}`, ok: false };
  }
  return { ok: true, value: undefined };
};

export { checkUuid, getTeamRecord, mutateTeam, sanitizeTeam };
