import { getRedis, isRedisConfigured } from "@/lib/redis";

type RateLimitResult = { allowed: boolean; remaining: number };

type RateLimitDeps = {
  increment: (key: string, windowSeconds: number) => Promise<number>;
  isRedisConfigured: () => boolean;
};

const INCR_WITH_EXPIRE = `
  local count = redis.call("INCR", KEYS[1])
  if count == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
  end
  return count
`;

const createRateLimiter = (deps: RateLimitDeps) => {
  return async (key: string, max: number, windowSeconds: number): Promise<RateLimitResult> => {
    const redisKey = `ratelimit:${key}`;

    if (!deps.isRedisConfigured()) {
      return { allowed: true, remaining: max };
    }

    const count = await deps.increment(redisKey, windowSeconds);

    if (count > max) {
      return { allowed: false, remaining: 0 };
    }

    return { allowed: true, remaining: max - count };
  };
};

const checkRateLimit = createRateLimiter({
  increment: async (key, windowSeconds) =>
    Number(await getRedis().eval(INCR_WITH_EXPIRE, 1, key, String(windowSeconds))),
  isRedisConfigured,
});

export { checkRateLimit, createRateLimiter };
