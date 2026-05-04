import { execFileSync } from "node:child_process";

import { createAuth, type Auth } from "@repo/auth/server";
import { prisma } from "@repo/db";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";

import { redis } from "./redis";

const resolveAppUrl = (): string => {
  if (process.env.NODE_ENV === "production" || process.env.CI) {
    return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  }

  try {
    return execFileSync("portless", ["get", "collabtime.web"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  }
};

// Lazily initialized auth instance to avoid build-time errors
// when environment variables aren't available
let cachedAuth: Auth | null = null;

const getAuthConfig = () => {
  const appUrl = resolveAppUrl();

  return {
    betterAuth: {
      secret: process.env.BETTER_AUTH_SECRET ?? "",
      url: appUrl,
      webAppUrl: process.env.WEB_APP_URL ?? appUrl,
    },
    // nextCookies() must be last — lets better-auth read cookies in RSC/Server Actions
    extraPlugins: [nextCookies()],
    ...(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL
      ? {
          resend: {
            apiKey: process.env.RESEND_API_KEY,
            fromEmail: process.env.RESEND_FROM_EMAIL,
          },
        }
      : {}),
    ...(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
      ? {
          secondaryStorage: {
            delete: async (key: string) => {
              await redis.del(key);
            },
            get: async (key: string) => {
              const value = await redis.get(key);
              if (value === null || value === undefined) {
                return null;
              }
              if (typeof value === "string") {
                return value;
              }
              if (typeof value === "object") {
                return JSON.stringify(value);
              }
              return String(value);
            },
            set: async (key: string, value: string, ttl?: number) => {
              await (ttl ? redis.setex(key, ttl, value) : redis.set(key, value));
            },
          },
        }
      : {}),
  };
};

/**
 * Get the auth instance (lazily initialized).
 */
const getAuth = (): Auth => {
  if (!cachedAuth) {
    cachedAuth = createAuth(prisma, getAuthConfig());
  }
  return cachedAuth;
};

// Proxy for backwards compatibility with existing imports
const auth = new Proxy({} as Auth, {
  get(_, prop) {
    const instance = getAuth();
    const value = instance[prop as keyof Auth];
    if (typeof value === "function") {
      return (value as (...args: Array<unknown>) => unknown).bind(instance);
    }
    return value;
  },
});

/**
 * Deduplicated getSession within a single RSC request via React.cache().
 */
const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export { auth, getAuth, getSession };
