import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { log } from "@/lib/observability";
import {
  DEFAULT_MEMBER_TIMEZONE,
  DEFAULT_WORKING_HOURS_END,
  DEFAULT_WORKING_HOURS_START,
} from "@/lib/timezones";
import type { TeamMember, TeamRecord } from "@/types";

import { isRedisConfigured, readTeamJson, redis, teamKey, TEAM_ACTIVE_TTL_SECONDS } from "./redis";
import {
  readTeamSummariesFromPostgres,
  type TeamSummary,
  writeTeamMirror,
} from "./team-postgres-repository";
import { UUIDSchema } from "./validation";

const StoredGroupSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  order: z.number(),
});

const StoredMemberSchema = z.looseObject({
  groupId: z.string().optional(),
  id: z.string(),
  name: z.string(),
  order: z.number().optional(),
  timezone: z.string(),
  title: z.string(),
  userId: z.string().optional(),
  workingHoursEnd: z.number(),
  workingHoursStart: z.number(),
});

/**
 * Loose rather than strict so a read can feed straight back into
 * writeTeamRecord: an unrecognised key on the blob is someone else's data, and
 * stripping it here would erase it on the next mutation. `groups` and `members`
 * are optional because rows written before those fields existed still resolve.
 */
const StoredTeamSchema = z.looseObject({
  adminPasswordHash: z.string().optional(),
  createdAt: z.string(),
  groups: z.array(StoredGroupSchema).optional(),
  id: z.string(),
  members: z.array(StoredMemberSchema).optional(),
  name: z.string(),
});

type StoredTeam = z.infer<typeof StoredTeamSchema>;

type MaybeStoredTeam = Partial<StoredTeam>;

const asText = (value: unknown, fallback: string): string =>
  typeof value === "string" && value !== "" ? value : fallback;

const toTeamRecord = (teamId: string, stored: MaybeStoredTeam): TeamRecord => ({
  ...stored,
  createdAt: asText(stored.createdAt, ""),
  groups: Array.isArray(stored.groups) ? stored.groups : [],
  id: asText(stored.id, teamId),
  members: (Array.isArray(stored.members) ? stored.members : []).map((m, i) =>
    Object.assign(m, { order: m.order ?? i }),
  ),
  name: asText(stored.name, ""),
});

type TeamRecordRead = { ok: false } | { ok: true; team: TeamRecord | null };

/**
 * Keeps "this team has no contents record" apart from "the read itself failed",
 * which readTeamRecord flattens into the same `null`. A caller about to write
 * cannot treat those alike: the second one says nothing about the team and
 * everything about the store.
 */
const loadTeamRecord = async (teamId: string): Promise<TeamRecordRead> => {
  const uuidResult = UUIDSchema.safeParse(teamId);
  if (!uuidResult.success) {
    return { ok: true, team: null };
  }

  try {
    const data = await readTeamJson(teamId);

    if (data === null) {
      return { ok: true, team: null };
    }

    const raw: unknown = JSON.parse(data);
    const parsed = StoredTeamSchema.safeParse(raw);

    if (parsed.success) {
      return { ok: true, team: toTeamRecord(teamId, parsed.data) };
    }

    log.error({
      error: parsed.error,
      message: "Stored team failed validation, reading it untrusted",
      route: "lib/team-store",
      teamId,
    });

    if (typeof raw !== "object" || raw === null) {
      return { ok: false };
    }

    return { ok: true, team: toTeamRecord(teamId, raw) };
  } catch (error) {
    log.error({ error, message: "Failed to get team", route: "lib/team-store", teamId });
    return { ok: false };
  }
};

const readTeamRecord = async (teamId: string): Promise<TeamRecord | null> => {
  const read = await loadTeamRecord(teamId);

  return read.ok ? read.team : null;
};

/**
 * Re-reads one team's contents when Postgres reports nothing for it, and returns
 * whichever side actually holds the team.
 *
 * Postgres is allowed to lag: a Space row is only filled in by the mirror, which
 * runs on a contents write, and `POST /api/spaces` creates a row without ever
 * writing contents. The May migration also left team blobs with no Space row at
 * all. Serving the Postgres side in those cases would show a live team as
 * unnamed with zero members, which reads as data loss rather than a gap, so
 * Redis (still the store of record for contents) wins and the gap is logged.
 */
const reconcileWithContents = async (
  teamId: string,
  mirrored: TeamSummary | null,
): Promise<TeamSummary | null> => {
  const read = await loadTeamRecord(teamId);

  if (!read.ok) {
    log.error({
      message: "Could not check team contents against the Postgres summary",
      route: "lib/team-store",
      teamId,
    });
    return mirrored;
  }

  if (read.team === null) {
    return mirrored;
  }

  const fromContents = { memberCount: read.team.members.length, name: read.team.name };

  if (fromContents.memberCount === 0 && fromContents.name === "") {
    return mirrored;
  }

  log.error({
    message: "Postgres team summary is absent or empty, served from team contents",
    mirrored,
    route: "lib/team-store",
    teamId,
  });

  return fromContents;
};

/**
 * One query for every team the caller needs, keyed by teamId. A teamId with no
 * resolvable summary is absent from the map rather than defaulted, so a caller
 * cannot render a fabricated zero count.
 */
const readTeamSummaries = async (teamIds: Array<string>): Promise<Map<string, TeamSummary>> => {
  const wanted = [...new Set(teamIds)].filter((id) => UUIDSchema.safeParse(id).success);

  if (wanted.length === 0) {
    return new Map<string, TeamSummary>();
  }

  const summaries = await readTeamSummariesFromPostgres(wanted);

  const unresolved = wanted.filter((id) => {
    const summary = summaries.get(id);
    return summary === undefined || (summary.memberCount === 0 && summary.name === "");
  });

  const reconciled = await Promise.all(
    unresolved.map(async (id) => {
      const summary = await reconcileWithContents(id, summaries.get(id) ?? null);
      return [id, summary] as const;
    }),
  );

  for (const [id, summary] of reconciled) {
    if (summary === null) {
      summaries.delete(id);
    } else {
      summaries.set(id, summary);
    }
  }

  return summaries;
};

const readTeamSummary = async (teamId: string): Promise<TeamSummary | null> => {
  const summaries = await readTeamSummaries([teamId]);

  return summaries.get(teamId) ?? null;
};

/**
 * Redis holds the team's contents; the Postgres rows are a mirror of them that
 * `readTeamSummaries` now serves name and member count from.
 *
 * A failed mirror must not fail the request: the user's write is already durable
 * in Redis, re-running the backfill repairs whatever the mirror missed, and
 * summary reads fall back to the contents in the meantime. It logs at error
 * level so the gap is visible.
 */
const writeTeamRecord = async (
  teamId: string,
  team: TeamRecord,
  ttlSeconds: number = TEAM_ACTIVE_TTL_SECONDS,
): Promise<void> => {
  await redis.set(teamKey(teamId), JSON.stringify(team), "EX", ttlSeconds);

  try {
    await writeTeamMirror(teamId, team);
  } catch (error) {
    log.error({ error, message: "Failed to mirror team to Postgres", route: "lib/team-store" });
  }
};

const newTeamMember = (overrides?: Partial<TeamMember>): TeamMember => ({
  id: uuidv4(),
  name: "",
  order: 0,
  timezone: DEFAULT_MEMBER_TIMEZONE,
  title: "",
  workingHoursEnd: DEFAULT_WORKING_HOURS_END,
  workingHoursStart: DEFAULT_WORKING_HOURS_START,
  ...overrides,
});

type TeamContentsMutation<TValue> = (
  team: TeamRecord | null,
) => { error: string; ok: false } | { ok: true; team: TeamRecord | null; value: TValue };

type TeamContentsResult<TValue> =
  | { ok: true; value: TValue }
  | {
      error: string;
      ok: false;
      reason: "read-failed" | "rejected" | "unconfigured" | "write-failed";
    };

/**
 * Read, mutate and write a team's contents as one step.
 *
 * Redis is the only store for those contents, so a failed write is lost data and
 * never an ignorable cache miss. The result is discriminated on `ok` so a caller
 * cannot read a value it did not get, and `reason` separates a store that is not
 * configured (where writes resolve as no-ops) from one that could not be read
 * and one that rejected the write.
 *
 * A mutation receives `null` when the team has no contents record, and returns
 * `team: null` to mean "nothing to persist", which skips the write and still
 * counts as a success. It is not called at all when the read failed, since a
 * store that is down looks identical to a team with nothing in it.
 */
const applyTeamContents = async <TValue>(
  teamId: string,
  mutate: TeamContentsMutation<TValue>,
  ttlSeconds: number = TEAM_ACTIVE_TTL_SECONDS,
): Promise<TeamContentsResult<TValue>> => {
  if (!isRedisConfigured()) {
    log.error({
      message: "Team contents write skipped: REDIS_URL is unset",
      route: "lib/team-store",
      teamId,
    });
    return { error: "Team storage is unavailable", ok: false, reason: "unconfigured" };
  }

  const read = await loadTeamRecord(teamId);

  if (!read.ok) {
    return { error: "Could not read the team", ok: false, reason: "read-failed" };
  }

  const outcome = mutate(read.team);

  if (!outcome.ok) {
    return { error: outcome.error, ok: false, reason: "rejected" };
  }

  if (outcome.team === null) {
    return { ok: true, value: outcome.value };
  }

  try {
    await writeTeamRecord(teamId, outcome.team, ttlSeconds);
  } catch (error) {
    log.error({ error, message: "Failed to write team contents", route: "lib/team-store", teamId });
    return { error: "Failed to save the team", ok: false, reason: "write-failed" };
  }

  return { ok: true, value: outcome.value };
};

export {
  applyTeamContents,
  newTeamMember,
  readTeamRecord,
  readTeamSummaries,
  readTeamSummary,
  writeTeamRecord,
};
