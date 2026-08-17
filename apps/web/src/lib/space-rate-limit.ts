import { isRedisConfigured, redis } from "@/lib/redis";

type RateLimitResult = { allowed: boolean; remaining: number };

const INCR_WITH_EXPIRE = `
  local count = redis.call("INCR", KEYS[1])
  if count == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
  end
  return count
`;

const checkRateLimit = async (
  key: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> => {
  const redisKey = `ratelimit:${key}`;

  // `eval` is absent from the unconfigured-Redis stub allowlist in lib/redis.ts,
  // so it must not be reached when there is no client to run it.
  if (!isRedisConfigured()) {
    return { allowed: true, remaining: max };
  }

  const count = Number(await redis.eval(INCR_WITH_EXPIRE, 1, redisKey, String(windowSeconds)));

  if (count > max) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: max - count };
};

export { checkRateLimit };
