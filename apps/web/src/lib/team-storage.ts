import { log } from "@/lib/observability";
import { publishTeamEvent } from "@/lib/team-events";
import type { TeamRecord } from "@/types";

import { isRedisConfigured, redis } from "./redis";
import {
  readTeamSummariesFromPostgres,
  type TeamSummary,
  writeTeamMirror,
} from "./team-postgres-repository";

type TeamStorage = {
  /** Stores `next` only while the contents still equal `expected` (null: absent), and marks `revision` as not yet mirrored. */
  compareAndSet: (
    teamId: string,
    expected: string | null,
    next: string,
    revision: string,
  ) => Promise<boolean>;
  mirror: (teamId: string, team: TeamRecord, revision: string) => Promise<void>;
  publish: (teamId: string) => Promise<void>;
  readContents: (teamId: string) => Promise<string | null>;
  /** Omits every team whose latest committed revision is not known to be mirrored. */
  readMirroredSummaries: (teamIds: Array<string>) => Promise<Map<string, TeamSummary>>;
};

const TEAM_INITIAL_TTL_SECONDS = 60 * 60 * 24 * 60;
const TEAM_ACTIVE_TTL_SECONDS = 60 * 60 * 24 * 365 * 2;

const contentsKey = (teamId: string): string => `team:${teamId}`;
// Outside `team:*`, which the maintenance scripts scan as team contents.
const mirrorKey = (teamId: string): string => `team-mirror:${teamId}`;

const COMPARE_AND_SET = `
  if (redis.call("GET", KEYS[1]) or "") ~= ARGV[1] then
    return 0
  end
  redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
  redis.call("SET", KEYS[2], ARGV[4], "EX", ARGV[5])
  return 1
`;

// A later revision may have mirrored before this one landed, so a foreign marker turns stale.
const SETTLE_MIRROR = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  end
  redis.call("SET", KEYS[1], "stale", "EX", ARGV[2])
  return 0
`;

const redisTeamStorage: TeamStorage = {
  compareAndSet: async (teamId, expected, next, revision) => {
    if (!isRedisConfigured()) {
      throw new Error("Team storage is unavailable: REDIS_URL is unset");
    }

    const ttlSeconds = expected === null ? TEAM_INITIAL_TTL_SECONDS : TEAM_ACTIVE_TTL_SECONDS;
    const applied = await redis.eval(
      COMPARE_AND_SET,
      2,
      contentsKey(teamId),
      mirrorKey(teamId),
      expected ?? "",
      next,
      ttlSeconds,
      revision,
      TEAM_ACTIVE_TTL_SECONDS,
    );

    return applied === 1;
  },
  mirror: async (teamId, team, revision) => {
    await writeTeamMirror(teamId, team);
    await redis.eval(SETTLE_MIRROR, 1, mirrorKey(teamId), revision, TEAM_ACTIVE_TTL_SECONDS);
  },
  publish: (teamId) => publishTeamEvent(teamId, "contents"),
  readContents: async (teamId) => {
    const key = contentsKey(teamId);
    const contents = await redis.get(key);

    if (contents === null || contents === "") {
      return null;
    }

    try {
      await redis.expire(key, TEAM_ACTIVE_TTL_SECONDS);
    } catch (error) {
      log.error({
        error,
        message: "Failed to refresh team TTL",
        route: "lib/team-storage",
        teamId,
      });
    }

    return contents;
  },
  readMirroredSummaries: async (teamIds) => {
    const [summaries, markers] = await Promise.all([
      readTeamSummariesFromPostgres(teamIds),
      isRedisConfigured() ? redis.mget(teamIds.map(mirrorKey)) : [],
    ]);

    for (const [index, teamId] of teamIds.entries()) {
      if (typeof markers[index] === "string") {
        summaries.delete(teamId);
      }
    }

    return summaries;
  },
};

export { COMPARE_AND_SET, redisTeamStorage, SETTLE_MIRROR };
export type { TeamStorage };
