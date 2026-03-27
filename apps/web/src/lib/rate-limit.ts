import { Ratelimit } from "@upstash/ratelimit";

import { getRedis } from "./redis";

// Lazy-initialized rate limiters to avoid build-time errors
let _passwordVerificationLimiter: Ratelimit | null = null;
let _loginLimiter: Ratelimit | null = null;
let _signupLimiter: Ratelimit | null = null;
let _apiLimiter: Ratelimit | null = null;

/**
 * Rate limiter for password verification attempts.
 * Allows 5 attempts per 15 minutes per IP + spaceId combination.
 */
const getPasswordVerificationLimiter = (): Ratelimit => {
  if (!_passwordVerificationLimiter) {
    _passwordVerificationLimiter = new Ratelimit({
      redis: getRedis()!,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      prefix: "ratelimit:password-verify",
      analytics: true,
    });
  }
  return _passwordVerificationLimiter;
};

/**
 * Rate limiter for login attempts.
 * Allows 10 attempts per 15 minutes per IP.
 */
const getLoginLimiter = (): Ratelimit => {
  if (!_loginLimiter) {
    _loginLimiter = new Ratelimit({
      redis: getRedis()!,
      limiter: Ratelimit.slidingWindow(10, "15 m"),
      prefix: "ratelimit:login",
      analytics: true,
    });
  }
  return _loginLimiter;
};

/**
 * Rate limiter for signup attempts.
 * Allows 5 attempts per hour per IP.
 */
const getSignupLimiter = (): Ratelimit => {
  if (!_signupLimiter) {
    _signupLimiter = new Ratelimit({
      redis: getRedis()!,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "ratelimit:signup",
      analytics: true,
    });
  }
  return _signupLimiter;
};

/**
 * General API rate limiter.
 * Allows 100 requests per minute per IP.
 */
const getApiLimiter = (): Ratelimit => {
  if (!_apiLimiter) {
    _apiLimiter = new Ratelimit({
      redis: getRedis()!,
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      prefix: "ratelimit:api",
      analytics: true,
    });
  }
  return _apiLimiter;
};

const ALLOWED_RESULT = { success: true, limit: 0, remaining: 0, reset: 0 } as const;

// Legacy exports for backwards compatibility - these are getters now
// When Redis is unavailable, rate limiting is bypassed (allows all requests)
const passwordVerificationLimiter = {
  limit: (key: string) =>
    getRedis() ? getPasswordVerificationLimiter().limit(key) : Promise.resolve(ALLOWED_RESULT),
};

const loginLimiter = {
  limit: (key: string) =>
    getRedis() ? getLoginLimiter().limit(key) : Promise.resolve(ALLOWED_RESULT),
};

const signupLimiter = {
  limit: (key: string) =>
    getRedis() ? getSignupLimiter().limit(key) : Promise.resolve(ALLOWED_RESULT),
};

const apiLimiter = {
  limit: (key: string) =>
    getRedis() ? getApiLimiter().limit(key) : Promise.resolve(ALLOWED_RESULT),
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

export { passwordVerificationLimiter, loginLimiter, signupLimiter, apiLimiter, getClientIp };
