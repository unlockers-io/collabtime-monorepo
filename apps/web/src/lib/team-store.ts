import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { log } from "@/lib/observability";
import {
  DEFAULT_MEMBER_TIMEZONE,
  DEFAULT_WORKING_HOURS_END,
  DEFAULT_WORKING_HOURS_START,
  isCommonTimezone,
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

const StoredTeamSchema = z.looseObject({
  adminPasswordHash: z.string().optional(),
  createdAt: z.string(),
  groups: z.array(StoredGroupSchema).optional(),
  id: z.string(),
  members: z.array(StoredMemberSchema).optional(),
  name: z.string(),
});

const RescuedMemberSchema = StoredMemberSchema.partial().extend({
  id: z.string().default(""),
  name: z.string().default(""),
  timezone: z.string().default(DEFAULT_MEMBER_TIMEZONE),
  title: z.string().default(""),
  workingHoursEnd: z.number().default(DEFAULT_WORKING_HOURS_END),
  workingHoursStart: z.number().default(DEFAULT_WORKING_HOURS_START),
});

const RescuedTeamSchema = z.looseObject({
  adminPasswordHash: z.string().optional(),
  createdAt: z.string().optional(),
  groups: z.array(StoredGroupSchema).default([]),
  id: z.string().optional(),
  members: z.array(RescuedMemberSchema).default([]),
  name: z.string().optional(),
});

type MaybeStoredTeam = z.infer<typeof RescuedTeamSchema> | z.infer<typeof StoredTeamSchema>;
type ErrorEvent = Parameters<typeof log.error>[0];

type TeamStoreDeps = {
  createId: () => string;
  isRedisConfigured: () => boolean;
  readTeamJson: typeof readTeamJson;
  readTeamSummariesFromPostgres: typeof readTeamSummariesFromPostgres;
  reportError: (event: ErrorEvent) => void;
  set: (key: string, value: string, mode: "EX", ttlSeconds: number) => Promise<void>;
  writeTeamMirror: typeof writeTeamMirror;
};

const defaultTeamStoreDeps: TeamStoreDeps = {
  createId: uuidv4,
  isRedisConfigured,
  readTeamJson,
  readTeamSummariesFromPostgres,
  reportError: log.error,
  set: async (key, value, mode, ttlSeconds) => {
    await redis.set(key, value, mode, ttlSeconds);
  },
  writeTeamMirror,
};

const asText = (value: string | undefined, fallback: string): string =>
  typeof value === "string" && value !== "" ? value : fallback;

const asTimezone = (value: string | undefined, teamId: string, deps: TeamStoreDeps): string => {
  if (typeof value !== "string" || value === "") {
    deps.reportError({
      message: "Stored member timezone is missing, using the default",
      route: "lib/team-store",
      teamId,
    });
    return DEFAULT_MEMBER_TIMEZONE;
  }

  if (isCommonTimezone(value)) {
    return value;
  }

  try {
    // Throws RangeError for a zone Intl does not know, which is the whole check.
    const probe = new Intl.DateTimeFormat("en", { timeZone: value });
    return probe.resolvedOptions().timeZone === "" ? DEFAULT_MEMBER_TIMEZONE : value;
  } catch {
    // Intl rejects it, so every downstream toLocaleString call would throw.
  }

  deps.reportError({
    message: "Stored member timezone is not a supported zone, using the default",
    route: "lib/team-store",
    teamId,
    timezone: value,
  });

  return DEFAULT_MEMBER_TIMEZONE;
};

const toTeamRecord = (
  teamId: string,
  stored: MaybeStoredTeam,
  deps: TeamStoreDeps,
): TeamRecord => ({
  ...stored,
  createdAt: asText(stored.createdAt, ""),
  groups: Array.isArray(stored.groups) ? stored.groups : [],
  id: asText(stored.id, teamId),
  members: (Array.isArray(stored.members) ? stored.members : []).map((m, i) =>
    Object.assign(m, { order: m.order ?? i, timezone: asTimezone(m.timezone, teamId, deps) }),
  ),
  name: asText(stored.name, ""),
});

type TeamRecordRead = { ok: false } | { ok: true; team: TeamRecord | null };

const loadTeamRecord = async (teamId: string, deps: TeamStoreDeps): Promise<TeamRecordRead> => {
  const uuidResult = UUIDSchema.safeParse(teamId);
  if (!uuidResult.success) {
    return { ok: true, team: null };
  }

  try {
    const data = await deps.readTeamJson(teamId);

    if (data === null) {
      return { ok: true, team: null };
    }

    const raw: unknown = JSON.parse(data);
    const parsed = StoredTeamSchema.safeParse(raw);

    if (parsed.success) {
      return { ok: true, team: toTeamRecord(teamId, parsed.data, deps) };
    }

    deps.reportError({
      error: parsed.error,
      message: "Stored team failed validation, reading it untrusted",
      route: "lib/team-store",
      teamId,
    });

    const rescued = RescuedTeamSchema.safeParse(raw);
    return rescued.success
      ? { ok: true, team: toTeamRecord(teamId, rescued.data, deps) }
      : { ok: false };
  } catch (error) {
    deps.reportError({ error, message: "Failed to get team", route: "lib/team-store", teamId });
    return { ok: false };
  }
};

const readTeamRecord = async (
  teamId: string,
  deps: TeamStoreDeps = defaultTeamStoreDeps,
): Promise<TeamRecord | null> => {
  const read = await loadTeamRecord(teamId, deps);

  return read.ok ? read.team : null;
};

const isEmptySummary = (summary: TeamSummary): boolean =>
  summary.memberCount === 0 && summary.name === "";

const summaryFromContents = async (
  teamId: string,
  deps: TeamStoreDeps,
): Promise<TeamSummary | null> => {
  const read = await loadTeamRecord(teamId, deps);

  if (!read.ok) {
    deps.reportError({
      message: "Could not check team contents against the Postgres summary",
      route: "lib/team-store",
      teamId,
    });
    return null;
  }

  if (read.team === null) {
    return null;
  }

  const fromContents = { memberCount: read.team.members.length, name: read.team.name };

  return isEmptySummary(fromContents) ? null : fromContents;
};

/**
 * One query for every team the caller needs, keyed by teamId. A teamId with no
 * resolvable summary is absent from the map rather than defaulted, so a caller
 * cannot render a fabricated zero count.
 */
const readTeamSummaries = async (
  teamIds: Array<string>,
  deps: TeamStoreDeps = defaultTeamStoreDeps,
): Promise<Map<string, TeamSummary>> => {
  const wanted = [...new Set(teamIds)].filter((id) => UUIDSchema.safeParse(id).success);

  if (wanted.length === 0) {
    return new Map<string, TeamSummary>();
  }

  const summaries = await deps.readTeamSummariesFromPostgres(wanted);

  const unresolved = wanted.filter((id) => {
    const summary = summaries.get(id);
    return summary === undefined || isEmptySummary(summary);
  });

  const reconciled = await Promise.all(
    unresolved.map(async (id) => [id, await summaryFromContents(id, deps)] as const),
  );

  for (const [id, summary] of reconciled) {
    if (summary === null) {
      continue;
    }

    deps.reportError({
      message: "Postgres team summary is absent or empty, served from team contents",
      mirrored: summaries.get(id) ?? null,
      route: "lib/team-store",
      teamId: id,
    });
    summaries.set(id, summary);
  }

  return summaries;
};

const readTeamSummary = async (
  teamId: string,
  deps: TeamStoreDeps = defaultTeamStoreDeps,
): Promise<TeamSummary | null> => {
  const summaries = await readTeamSummaries([teamId], deps);

  return summaries.get(teamId) ?? null;
};

const writeTeamRecord = async (
  teamId: string,
  team: TeamRecord,
  ttlSeconds: number = TEAM_ACTIVE_TTL_SECONDS,
  deps: TeamStoreDeps = defaultTeamStoreDeps,
): Promise<void> => {
  await deps.set(teamKey(teamId), JSON.stringify(team), "EX", ttlSeconds);

  try {
    await deps.writeTeamMirror(teamId, team);
  } catch (error) {
    deps.reportError({
      error,
      message: "Failed to mirror team to Postgres",
      route: "lib/team-store",
    });
  }
};

const newTeamMember = (
  overrides?: Partial<TeamMember>,
  deps: TeamStoreDeps = defaultTeamStoreDeps,
): TeamMember => ({
  id: deps.createId(),
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

const applyTeamContents = async <TValue>(
  teamId: string,
  mutate: TeamContentsMutation<TValue>,
  ttlSeconds: number = TEAM_ACTIVE_TTL_SECONDS,
  deps: TeamStoreDeps = defaultTeamStoreDeps,
): Promise<TeamContentsResult<TValue>> => {
  if (!deps.isRedisConfigured()) {
    deps.reportError({
      message: "Team contents write skipped: REDIS_URL is unset",
      route: "lib/team-store",
      teamId,
    });
    return { error: "Team storage is unavailable", ok: false, reason: "unconfigured" };
  }

  const read = await loadTeamRecord(teamId, deps);

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
    await writeTeamRecord(teamId, outcome.team, ttlSeconds, deps);
  } catch (error) {
    deps.reportError({
      error,
      message: "Failed to write team contents",
      route: "lib/team-store",
      teamId,
    });
    return { error: "Failed to save the team", ok: false, reason: "write-failed" };
  }

  return { ok: true, value: outcome.value };
};

export type { TeamStoreDeps };

export {
  applyTeamContents,
  newTeamMember,
  readTeamRecord,
  readTeamSummaries,
  readTeamSummary,
  writeTeamRecord,
};
