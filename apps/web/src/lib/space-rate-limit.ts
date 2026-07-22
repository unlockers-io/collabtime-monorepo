import { redis } from "@/lib/redis";

type RateLimitResult = { allowed: boolean; remaining: number };

// Atomic fixed-window limiter; degrades OPEN when Redis is absent. INCR+EXPIRE in one Lua step avoids racy read-modify-write.
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

  // Degrade OPEN: probe `get` first: unset REDIS_URL makes the proxy return null for get but throw on eval.
  const probe = await redis.get(redisKey);
  if (probe === null && (process.env.REDIS_URL === undefined || process.env.REDIS_URL === "")) {
    return { allowed: true, remaining: max };
  }

  const count = Number(await redis.eval(INCR_WITH_EXPIRE, 1, redisKey, String(windowSeconds)));

  if (count > max) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: max - count };
};

export { checkRateLimit };
