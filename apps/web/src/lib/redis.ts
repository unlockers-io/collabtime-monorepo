import { Redis } from "ioredis";

let cachedRedis: Redis | null = null;

/**
 * Get the Redis client instance.
 * Uses lazy initialization to avoid build-time errors when env vars aren't available
 * and to defer the TCP handshake until first command on Vercel cold starts.
 */
const getRedis = (): Redis | null => {
  if (cachedRedis) {
    return cachedRedis;
  }

  const url = process.env.REDIS_URL;

  if (!url) {
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

/**
 * Proxy object that provides lazy Redis access.
 * Allows imports to work at build time while deferring
 * actual Redis connection to runtime.
 */
const redis = new Proxy({} as Redis, {
  get(_, prop) {
    const instance = getRedis();
    if (!instance) {
      // No-op fallback when Redis is unavailable: graceful degradation
      if (
        typeof prop === "string" &&
        ["get", "set", "setex", "del", "scan", "publish"].includes(prop)
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

// TTL for newly created teams (2 months)
const TEAM_INITIAL_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days

// TTL for teams with members (2 years)
const TEAM_ACTIVE_TTL_SECONDS = 60 * 60 * 24 * 365 * 2; // 2 years

export { redis, TEAM_INITIAL_TTL_SECONDS, TEAM_ACTIVE_TTL_SECONDS };
