import { Redis } from "ioredis";

import { log } from "@/lib/observability";

let cachedRedis: Redis | null = null;

// The Proxy below answers writes with a resolved `null` when there is no URL, which
// is indistinguishable from a successful write. Callers that must not report a
// phantom success ask this first.
const isRedisConfigured = (): boolean => {
  const url = process.env.REDIS_URL;
  return url !== undefined && url !== "";
};

// Lazy init: env vars may be missing at build time, and we defer the TCP handshake on cold starts.
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

// oxlint-disable no-unsafe-type-assertion -- the Proxy impersonates Redis by design; its target is an empty stand-in and property access is forwarded dynamically.
const redis = new Proxy({} as Redis, {
  get(_, prop) {
    const instance = getRedis();
    if (!instance) {
      // Graceful degradation when Redis isn't configured (REDIS_URL is optional so CI
      // and builds work without it). Gotcha: writes (set/setex/del) resolve as no-ops,
      // which no caller can tell apart from success. The ones that must not report a
      // phantom success call isRedisConfigured() first, which applyTeamContents does
      // and mutateTeam still does not, so every mutateTeam action reports success
      // while persisting nothing. Production must set REDIS_URL; this branch is for
      // environments without real traffic.
      if (
        typeof prop === "string" &&
        ["get", "set", "setex", "expire", "del", "scan", "publish"].includes(prop)
      ) {
        return () => Promise.resolve(null);
      }
      return undefined;
    }
    const value = instance[prop as keyof Redis];
    if (typeof value === "function") {
      return (value as (...args: Array<unknown>) => unknown).bind(instance);
    }
    return value;
  },
});
// oxlint-enable no-unsafe-type-assertion

const TEAM_INITIAL_TTL_SECONDS = 60 * 60 * 24 * 60;

const TEAM_ACTIVE_TTL_SECONDS = 60 * 60 * 24 * 365 * 2;

const teamKey = (teamId: string): string => `team:${teamId}`;

/**
 * Redis is the only store for a team's contents, so an expiring key is a
 * deleted team, not a cold cache. Only writes used to extend the TTL, which
 * meant a team that people read every day but never renamed vanished silently
 * on the 60th day. Every read re-extends the key instead.
 *
 * A failed refresh must not fail the read: the caller already has the data,
 * and the next read gets another chance to extend.
 */
const readTeamJson = async (teamId: string): Promise<string | null> => {
  const key = teamKey(teamId);
  const data = await redis.get(key);

  if (data === null || data === "") {
    return null;
  }

  try {
    await redis.expire(key, TEAM_ACTIVE_TTL_SECONDS);
  } catch (error) {
    log.error({ error, message: "Failed to refresh team TTL", route: "lib/redis" });
  }

  return data;
};

export {
  isRedisConfigured,
  readTeamJson,
  redis,
  teamKey,
  TEAM_INITIAL_TTL_SECONDS,
  TEAM_ACTIVE_TTL_SECONDS,
};
