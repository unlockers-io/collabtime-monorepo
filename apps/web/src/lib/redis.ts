import { Redis, type RedisOptions } from "ioredis";

let cachedRedis: Redis | null = null;

const isRedisConfigured = (): boolean => {
  const url = process.env.REDIS_URL;
  return url !== undefined && url !== "";
};

/**
 * Every connection shares these: `family: 0` for Railway's dual-stack DNS,
 * `lazyConnect` so importing never opens a socket. Returns null when unset.
 */
const createRedisClient = (overrides: RedisOptions = {}): Redis | null => {
  const url = process.env.REDIS_URL;

  if (url === undefined || url === "") {
    return null;
  }

  return new Redis(url, {
    enableAutoPipelining: true,
    family: 0,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    ...overrides,
  });
};

const getRedis = (): Redis => {
  cachedRedis ??= createRedisClient();
  if (!cachedRedis) {
    throw new Error("Redis is unavailable: REDIS_URL is unset");
  }
  return cachedRedis;
};

export { createRedisClient, getRedis, isRedisConfigured };
