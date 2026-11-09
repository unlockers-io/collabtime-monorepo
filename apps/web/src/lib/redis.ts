import { Redis, type RedisOptions } from "ioredis";

import { getEnv } from "./env";

let cachedRedis: Redis | null = null;

const INCREMENT_WITH_EXPIRY = `
local value = redis.call("INCR", KEYS[1])
if value == 1 and tonumber(ARGV[1]) > 0 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return value
`;

const isRedisConfigured = (): boolean => getEnv("REDIS_URL") !== undefined;

/**
 * Every connection shares these: `family: 0` for Railway's dual-stack DNS,
 * `lazyConnect` so importing never opens a socket. Returns null when unset.
 */
const createRedisClient = (overrides: RedisOptions = {}): Redis | null => {
  const url = getEnv("REDIS_URL");

  if (url === undefined) {
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

/** Increments `key`, starting its expiry on the first increment. */
const incrementWithExpiry = async (key: string, ttlSeconds: number): Promise<number> => {
  const value = await getRedis().eval(INCREMENT_WITH_EXPIRY, 1, key, ttlSeconds);

  if (typeof value !== "number") {
    throw new TypeError("Redis increment returned a non-numeric value");
  }

  return value;
};

export { createRedisClient, getRedis, incrementWithExpiry, isRedisConfigured };
