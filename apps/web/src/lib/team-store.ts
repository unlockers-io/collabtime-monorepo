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
import { writeTeamMirror } from "./team-mirror";
import { UUIDSchema } from "./validation";

const StoredGroupSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  order: z.number(),
});

// `order` is optional because legacy rows predate it; it is backfilled on read.
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

// A blob that fails validation is still read rather than dropped, so nothing the
// schema requires can be assumed present by the time it reaches toTeamRecord.
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

    // Redis holds the only copy of a team's contents, so a row written before a
    // field existed still has to resolve: dropping it here would 404 the team
    // page, fail every mutation on it, and hide it from the teams list.
    if (typeof raw !== "object" || raw === null) {
      // Reported as a failed read rather than an absent one so a mutation cannot
      // overwrite a blob that simply could not be interpreted.
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

type TeamSummary = {
  memberCount: number;
  name: string;
};

const readTeamSummary = async (teamId: string): Promise<TeamSummary | null> => {
  const team = await readTeamRecord(teamId);

  if (team === null) {
    return null;
  }

  return { memberCount: team.members.length, name: team.name };
};

/**
 * Dual-write phase of moving team contents into Postgres: Redis stays the store
 * every read goes through, and the Postgres rows are a shadow copy that the
 * backfill and verify scripts compare against.
 *
 * A failed mirror must not fail the request. Until the read path cuts over, the
 * user's write is already durable in Redis, and re-running the backfill repairs
 * whatever the mirror missed. It logs at error level so the gap is visible.
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

export { applyTeamContents, newTeamMember, readTeamRecord, readTeamSummary, writeTeamRecord };
export type { TeamSummary };
