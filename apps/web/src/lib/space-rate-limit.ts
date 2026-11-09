import { incrementWithExpiry, isRedisConfigured } from "@/lib/redis";

type RateLimitResult = { allowed: boolean; remaining: number };

type RateLimitDeps = {
  increment: (key: string, windowSeconds: number) => Promise<number>;
  isRedisConfigured: () => boolean;
};

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

const checkRateLimit = createRateLimiter({ increment: incrementWithExpiry, isRedisConfigured });

export { checkRateLimit, createRateLimiter };
