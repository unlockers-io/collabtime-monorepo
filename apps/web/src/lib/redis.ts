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

const getRedis = (): Redis | null => {
  cachedRedis ??= createRedisClient();
  return cachedRedis;
};

// SAFETY: The proxy forwards every configured call to an ioredis instance.
// oxlint-disable-next-line no-unsafe-type-assertion -- an empty Proxy target cannot be typed as the Redis it forwards to
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
    // oxlint-disable-next-line no-unsafe-type-assertion -- Proxy traps receive string | symbol keys, not keyof Redis
    const value = instance[prop as keyof Redis];
    if (typeof value === "function") {
      // SAFETY: ioredis methods require their owning Redis instance as this.
      // oxlint-disable-next-line no-unsafe-type-assertion -- typeof narrows to Function, which has no callable signature to bind
      return (value as (...args: Array<never>) => void).bind(instance);
    }
    return value;
  },
});

export { createRedisClient, isRedisConfigured, redis };
