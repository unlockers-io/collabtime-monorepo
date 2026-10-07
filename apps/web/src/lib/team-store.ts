import { updateTag } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { log } from "@/lib/observability";
import {
  DEFAULT_MEMBER_TIMEZONE,
  DEFAULT_WORKING_HOURS_END,
  DEFAULT_WORKING_HOURS_START,
  isCommonTimezone,
} from "@/lib/timezones";
import type { TeamRecord } from "@/types";

import type { TeamCommand } from "./team-commands";
import { redisTeamStorage, type TeamStorage } from "./team-storage";
import { UUIDSchema } from "./validation";

const StoredGroupSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  order: z.number(),
});

const StoredMemberSchema = z.looseObject({
  groupId: z.string().optional(),
  id: z.string(),
  membershipRevision: z.string().optional(),
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
type ReportError = (event: Parameters<typeof log.error>[0]) => void;

type TeamStoreDeps = {
  createId: () => string;
  invalidateTeamName: (teamId: string) => void;
  reportError: ReportError;
  storage: TeamStorage;
};

type TeamContentsFailureReason = "conflict" | "read-failed" | "rejected" | "write-failed";
type TeamSummary = { memberCount: number; name: string };
type TeamContentsFailure = { error: string; ok: false; reason: TeamContentsFailureReason };
type TeamContentsResult<TValue> =
  | TeamContentsFailure
  | { ok: true; team: TeamRecord; value: TValue };
type Snapshot = { contents: string; team: TeamRecord } | null;

const ROUTE = "lib/team-store";
const MAX_APPLY_ATTEMPTS = 5;

const isUuid = (value: string): boolean => UUIDSchema.safeParse(value).success;

const asText = (value: string | undefined, fallback: string): string =>
  typeof value === "string" && value !== "" ? value : fallback;

const asTimezone = (
  value: string | undefined,
  teamId: string,
  reportError: ReportError,
): string => {
  if (typeof value !== "string" || value === "") {
    reportError({
      message: "Stored member timezone is missing, using the default",
      route: ROUTE,
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

  reportError({
    message: "Stored member timezone is not a supported zone, using the default",
    route: ROUTE,
    teamId,
    timezone: value,
  });

  return DEFAULT_MEMBER_TIMEZONE;
};

const toTeamRecord = (
  teamId: string,
  stored: MaybeStoredTeam,
  reportError: ReportError,
): TeamRecord => {
  const groups = Array.isArray(stored.groups) ? stored.groups : [];
  const groupIds = new Set(groups.map((group) => group.id));

  return {
    ...stored,
    createdAt: asText(stored.createdAt, ""),
    groups,
    id: asText(stored.id, teamId),
    members: (Array.isArray(stored.members) ? stored.members : []).map((m, i) =>
      Object.assign(m, {
        // A dangling groupId breaks the mirror's foreign key, so it reads as ungrouped.
        groupId: m.groupId !== undefined && groupIds.has(m.groupId) ? m.groupId : undefined,
        order: m.order ?? i,
        timezone: asTimezone(m.timezone, teamId, reportError),
      }),
    ),
    name: asText(stored.name, ""),
  };
};

const decodeTeam = (teamId: string, contents: string, reportError: ReportError) => {
  const raw: unknown = JSON.parse(contents);
  const parsed = StoredTeamSchema.safeParse(raw);

  if (parsed.success) {
    return toTeamRecord(teamId, parsed.data, reportError);
  }

  reportError({
    error: parsed.error,
    message: "Stored team failed validation, reading it untrusted",
    route: ROUTE,
    teamId,
  });

  const rescued = RescuedTeamSchema.safeParse(raw);
  return rescued.success ? toTeamRecord(teamId, rescued.data, reportError) : null;
};

const createTeamStore = (deps: TeamStoreDeps) => {
  const load = async (
    teamId: string,
  ): Promise<{ ok: false } | { ok: true; snapshot: Snapshot }> => {
    if (!isUuid(teamId)) {
      return { ok: true, snapshot: null };
    }

    try {
      const contents = await deps.storage.readContents(teamId);
      if (contents === null) {
        return { ok: true, snapshot: null };
      }

      const team = decodeTeam(teamId, contents, deps.reportError);
      return team === null ? { ok: false } : { ok: true, snapshot: { contents, team } };
    } catch (error) {
      deps.reportError({ error, message: "Failed to get team", route: ROUTE, teamId });
      return { ok: false };
    }
  };

  /** Resolves false when the contents changed since `expected` was read. */
  const commit = async (
    teamId: string,
    expected: string | null,
    team: TeamRecord,
  ): Promise<TeamContentsFailure | boolean> => {
    try {
      const stored = JSON.stringify(team);
      if (!(await deps.storage.compareAndSet(teamId, expected, stored))) {
        return false;
      }
    } catch (error) {
      deps.reportError({ error, message: "Failed to write team contents", route: ROUTE, teamId });
      return { error: "Failed to save the team", ok: false, reason: "write-failed" };
    }

    await deps.storage.publish(teamId);

    try {
      await deps.storage.mirror(teamId, team);
    } catch (error) {
      deps.reportError({
        error,
        message: "Failed to mirror team to Postgres",
        route: ROUTE,
        teamId,
      });
    }

    return true;
  };

  const applyTeamCommand = async <TValue>(
    teamId: string,
    command: TeamCommand<TValue>,
  ): Promise<TeamContentsResult<TValue>> => {
    for (let attempt = 1; attempt <= MAX_APPLY_ATTEMPTS; attempt += 1) {
      const read = await load(teamId);
      if (!read.ok) {
        return { error: "Could not read the team", ok: false, reason: "read-failed" };
      }
      if (read.snapshot === null) {
        return { error: "Team not found", ok: false, reason: "rejected" };
      }

      const { contents, team } = read.snapshot;
      const before = JSON.stringify(team);
      const previousName = team.name;
      const outcome = command(team, { createId: deps.createId });

      if (!outcome.ok) {
        return { ...outcome, reason: "rejected" };
      }
      if (JSON.stringify(outcome.team) === before) {
        return outcome;
      }

      const committed = await commit(teamId, contents, outcome.team);

      if (committed === true) {
        if (outcome.team.name !== previousName) {
          deps.invalidateTeamName(teamId);
        }
        return outcome;
      }
      if (committed !== false) {
        return committed;
      }
    }

    deps.reportError({ message: "Team contents kept changing while saving", route: ROUTE, teamId });
    return {
      error: "This workspace changed while saving. Try again.",
      ok: false,
      reason: "conflict",
    };
  };

  const createTeamContents = async (
    teamId: string,
    team: TeamRecord,
  ): Promise<TeamContentsFailure | { ok: true }> => {
    const committed = await commit(teamId, null, team);

    if (committed === true) {
      return { ok: true };
    }
    return committed === false
      ? { error: "Team already exists", ok: false, reason: "rejected" }
      : committed;
  };

  const readTeamRecord = async (teamId: string): Promise<TeamRecord | null> => {
    const read = await load(teamId);
    return read.ok ? (read.snapshot?.team ?? null) : null;
  };

  // Unreadable teams are omitted so callers cannot render a fabricated zero count.
  const readTeamSummaries = async (teamIds: Array<string>): Promise<Map<string, TeamSummary>> => {
    const wanted = [...new Set(teamIds)].filter(isUuid);

    if (wanted.length === 0) {
      return new Map<string, TeamSummary>();
    }

    const contents = await deps.storage.readContentsBatch(wanted);
    const summaries = new Map<string, TeamSummary>();
    for (const [index, teamId] of wanted.entries()) {
      const stored = contents[index];
      if (stored === null || stored === undefined) {
        continue;
      }
      try {
        const team = decodeTeam(teamId, stored, deps.reportError);
        if (team !== null) {
          summaries.set(teamId, { memberCount: team.members.length, name: team.name });
        }
      } catch (error) {
        deps.reportError({ error, message: "Failed to read team summary", route: ROUTE, teamId });
      }
    }

    return summaries;
  };

  const readTeamSummary = async (teamId: string): Promise<TeamSummary | null> => {
    const summaries = await readTeamSummaries([teamId]);
    return summaries.get(teamId) ?? null;
  };

  return {
    applyTeamCommand,
    createTeamContents,
    readTeamRecord,
    readTeamSummaries,
    readTeamSummary,
  };
};

const teamNameTag = (teamId: string): string => `team-name:${teamId}`;

const { applyTeamCommand, createTeamContents, readTeamRecord, readTeamSummaries, readTeamSummary } =
  createTeamStore({
    createId: uuidv4,
    invalidateTeamName: (teamId) => {
      updateTag(teamNameTag(teamId));
    },
    reportError: log.error,
    storage: redisTeamStorage,
  });

export {
  applyTeamCommand,
  createTeamContents,
  createTeamStore,
  readTeamRecord,
  readTeamSummaries,
  readTeamSummary,
  teamNameTag,
};
export type { TeamContentsFailure, TeamContentsFailureReason, TeamContentsResult, TeamStoreDeps };
