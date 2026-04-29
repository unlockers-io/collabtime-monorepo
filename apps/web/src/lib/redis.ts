import { Redis } from "@upstash/redis";

let cachedRedis: Redis | null = null;

/**
 * Get the Redis client instance.
 * Uses lazy initialization to avoid build-time errors when env vars aren't available.
 */
const getRedis = (): Redis | null => {
  if (cachedRedis) {
    return cachedRedis;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  cachedRedis = new Redis({ token, url });
  return cachedRedis;
};

/**
 * Proxy object that provides lazy Redis access.
 * This allows imports to work at build time while deferring
 * actual Redis connection to runtime.
 *
 * Note: This is a Proxy, not a real Redis instance. For cases requiring
 * the actual Redis instance (like @upstash/realtime), use getRedis() directly.
 */
const redis = new Proxy({} as Redis, {
  get(_, prop) {
    const instance = getRedis();
    if (!instance) {
      // Return no-op functions and undefined for properties when Redis is unavailable
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
      return value.bind(instance);
    }
    return value;
  },
});

// TTL for newly created teams (2 months)
const TEAM_INITIAL_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days

// TTL for teams with members (2 years)
const TEAM_ACTIVE_TTL_SECONDS = 60 * 60 * 24 * 365 * 2; // 2 years

export { redis, getRedis, TEAM_INITIAL_TTL_SECONDS, TEAM_ACTIVE_TTL_SECONDS };
