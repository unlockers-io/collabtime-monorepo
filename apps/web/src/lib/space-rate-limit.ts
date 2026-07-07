import { redis } from "@/lib/redis";

type RateLimitResult = { allowed: boolean; remaining: number };

// Atomic fixed-window limiter. Increments a per-key counter and sets the window
// TTL only on the first hit (so the window expires after `windowSeconds`
// rather than sliding). Returns { allowed: false } once `max` attempts occur in
// the window. Degrades OPEN when Redis is absent.
//
// INCR + first-hit EXPIRE is performed in one server-side step so concurrent
// attempts cannot read-modify-write the same count (a get-then-write approach is
// racy and resets the TTL every call).
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

  // Degrade OPEN: when REDIS_URL is unset the proxy returns null for `get`
  // (allowlisted) and `eval` is NOT allowlisted, so probe with `get` first and
  // bail to "allowed" if Redis is absent — never call `eval` through a missing
  // proxy (it would throw).
  const probe = await redis.get(redisKey);
  if (probe === null && !process.env.REDIS_URL) {
    return { allowed: true, remaining: max };
  }

  // Redis is present: do the atomic increment. `eval` exists on the real ioredis
  // instance (the proxy forwards any method when an instance exists).
  const count = Number(await redis.eval(INCR_WITH_EXPIRE, 1, redisKey, String(windowSeconds)));

  if (count > max) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: max - count };
};

export { checkRateLimit };
