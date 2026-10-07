import { log } from "@/lib/observability";
import { publishTeamEvent } from "@/lib/team-events";
import type { TeamRecord } from "@/types";

import { isRedisConfigured, redis } from "./redis";
import { writeTeamMirror } from "./team-postgres-repository";

type TeamStorage = {
  /** Stores `next` only while the contents still equal `expected` (null: absent). */
  compareAndSet: (teamId: string, expected: string | null, next: string) => Promise<boolean>;
  /** Best-effort Postgres copy for backfill tooling; never used for live summaries. */
  mirror: (teamId: string, team: TeamRecord) => Promise<void>;
  publish: (teamId: string) => Promise<void>;
  readContents: (teamId: string) => Promise<string | null>;
  readContentsBatch: (teamIds: Array<string>) => Promise<Array<string | null>>;
};

const TEAM_INITIAL_TTL_SECONDS = 60 * 60 * 24 * 60;
const TEAM_ACTIVE_TTL_SECONDS = 60 * 60 * 24 * 365 * 2;

const contentsKey = (teamId: string): string => `team:${teamId}`;

const COMPARE_AND_SET = `
  if (redis.call("GET", KEYS[1]) or "") ~= ARGV[1] then
    return 0
  end
  redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
  return 1
`;

const readContentsBatch = async (teamIds: Array<string>): Promise<Array<string | null>> => {
  if (teamIds.length === 0) {
    return [];
  }
  if (!isRedisConfigured()) {
    throw new Error("Team storage is unavailable: REDIS_URL is unset");
  }

  const contents = await redis.mget(teamIds.map(contentsKey));
  return Promise.all(
    teamIds.map(async (teamId, index) => {
      const value = contents[index];
      if (value === null || value === undefined || value === "") {
        return null;
      }

      try {
        await redis.expire(contentsKey(teamId), TEAM_ACTIVE_TTL_SECONDS);
      } catch (error) {
        log.error({
          error,
          message: "Failed to refresh team TTL",
          route: "lib/team-storage",
          teamId,
        });
      }

      return value;
    }),
  );
};

const redisTeamStorage: TeamStorage = {
  compareAndSet: async (teamId, expected, next) => {
    if (!isRedisConfigured()) {
      throw new Error("Team storage is unavailable: REDIS_URL is unset");
    }

    const ttlSeconds = expected === null ? TEAM_INITIAL_TTL_SECONDS : TEAM_ACTIVE_TTL_SECONDS;
    const applied = await redis.eval(
      COMPARE_AND_SET,
      1,
      contentsKey(teamId),
      expected ?? "",
      next,
      ttlSeconds,
    );

    return applied === 1;
  },
  mirror: writeTeamMirror,
  publish: (teamId) => publishTeamEvent(teamId, "contents"),
  readContents: async (teamId) => {
    const [contents] = await readContentsBatch([teamId]);
    return contents ?? null;
  },
  readContentsBatch,
};

export { COMPARE_AND_SET, redisTeamStorage };
export type { TeamStorage };
