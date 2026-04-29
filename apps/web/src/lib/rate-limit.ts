import { Ratelimit } from "@upstash/ratelimit";

import { getRedis } from "./redis";

let cachedPasswordVerificationLimiter: Ratelimit | null = null;

/**
 * Rate limiter for password verification attempts.
 * Allows 5 attempts per 15 minutes per IP + spaceId combination.
 */
const getPasswordVerificationLimiter = (): Ratelimit | null => {
  if (cachedPasswordVerificationLimiter) {
    return cachedPasswordVerificationLimiter;
  }
  const redis = getRedis();
  if (!redis) {
    return null;
  }
  cachedPasswordVerificationLimiter = new Ratelimit({
    analytics: true,
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    prefix: "ratelimit:password-verify",
    redis,
  });
  return cachedPasswordVerificationLimiter;
};

const ALLOWED_RESULT = { limit: 0, remaining: 0, reset: 0, success: true } as const;

// Bypasses rate limiting when Redis is unavailable (allows all requests)
const passwordVerificationLimiter = {
  limit: (key: string) => {
    const limiter = getPasswordVerificationLimiter();
    return limiter ? limiter.limit(key) : Promise.resolve(ALLOWED_RESULT);
  },
};

/**
 * Get the client IP address from request headers.
 */
const getClientIp = (request: Request): string => {
  // Check various headers that proxies/CDNs might set
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Vercel-specific header
  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  if (vercelIp) {
    return vercelIp.split(",")[0]?.trim() ?? "unknown";
  }

  return "unknown";
};

export { passwordVerificationLimiter, getClientIp };
