import { Redis } from "ioredis";

import { log } from "@/lib/observability";

let cachedRedis: Redis | null = null;

const isRedisConfigured = (): boolean => {
  const url = process.env.REDIS_URL;
  return url !== undefined && url !== "";
};

const getRedis = (): Redis | null => {
  if (cachedRedis) {
    return cachedRedis;
  }

  const url = process.env.REDIS_URL;

  if (url === undefined || url === "") {
    return null;
  }

  cachedRedis = new Redis(url, {
    enableAutoPipelining: true,
    family: 0,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

  return cachedRedis;
};

// SAFETY: The proxy forwards every configured call to an ioredis instance.
// oxlint-disable-next-line no-unsafe-type-assertion
const redis = new Proxy({} as Redis, {
  get(_, prop) {
    const instance = getRedis();
    if (!instance) {
      if (
        typeof prop === "string" &&
        ["get", "set", "setex", "expire", "del", "scan", "publish"].includes(prop)
      ) {
        return () => Promise.resolve(null);
      }
      return undefined;
    }
    // SAFETY: Proxy property keys are the same keys used to access the Redis instance.
    // oxlint-disable-next-line no-unsafe-type-assertion
    const value = instance[prop as keyof Redis];
    if (typeof value === "function") {
      // SAFETY: ioredis methods require their owning Redis instance as this.
      // oxlint-disable-next-line no-unsafe-type-assertion
      return (value as (...args: Array<never>) => void).bind(instance);
    }
    return value;
  },
});

const TEAM_INITIAL_TTL_SECONDS = 60 * 60 * 24 * 60;

const TEAM_ACTIVE_TTL_SECONDS = 60 * 60 * 24 * 365 * 2;

const teamKey = (teamId: string): string => `team:${teamId}`;

type TeamJsonReaderDeps = {
  expire: (key: string, seconds: number) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  reportError: (event: Record<string, unknown>) => void;
};

/**
 * Redis is the only store for a team's contents, so an expiring key is a
 * deleted team, not a cold cache. Only writes used to extend the TTL, which
 * meant a team that people read every day but never renamed vanished silently
 * on the 60th day. Every read re-extends the key instead.
 *
 * A failed refresh must not fail the read: the caller already has the data,
 * and the next read gets another chance to extend.
 */
const createTeamJsonReader = (deps: TeamJsonReaderDeps) => {
  return async (teamId: string): Promise<string | null> => {
    const key = teamKey(teamId);
    const data = await deps.get(key);

    if (data === null || data === "") {
      return null;
    }

    try {
      await deps.expire(key, TEAM_ACTIVE_TTL_SECONDS);
    } catch (error) {
      deps.reportError({ error, message: "Failed to refresh team TTL", route: "lib/redis" });
    }

    return data;
  };
};

const readTeamJson = createTeamJsonReader({
  expire: async (key, seconds) => {
    await redis.expire(key, seconds);
  },
  get: (key) => redis.get(key),
  reportError: log.error,
});

export {
  createTeamJsonReader,
  isRedisConfigured,
  readTeamJson,
  redis,
  teamKey,
  TEAM_INITIAL_TTL_SECONDS,
  TEAM_ACTIVE_TTL_SECONDS,
};
