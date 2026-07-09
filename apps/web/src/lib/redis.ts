import { Redis } from "ioredis";

let cachedRedis: Redis | null = null;

// Lazy init: env vars may be missing at build time, and we defer the TCP handshake on cold starts.
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

const redis = new Proxy({} as Redis, {
  get(_, prop) {
    const instance = getRedis();
    if (!instance) {
      // Graceful degradation when Redis isn't configured.
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

const TEAM_INITIAL_TTL_SECONDS = 60 * 60 * 24 * 60;

const TEAM_ACTIVE_TTL_SECONDS = 60 * 60 * 24 * 365 * 2;

export { redis, TEAM_INITIAL_TTL_SECONDS, TEAM_ACTIVE_TTL_SECONDS };
