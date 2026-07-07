import { createAuth, type Auth, type AuthConfig } from "@repo/auth/server";
import { prisma } from "@repo/db";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";

import { log } from "./observability";
import { redis } from "./redis";
import { joinPrivateSpacesFromCookies } from "./space-join";

// Lazy init: env vars may be unavailable at build time.
let cachedAuth: Auth | null = null;

const getAuthConfig = (): AuthConfig => {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "BETTER_AUTH_SECRET must be set to at least 32 characters (generate with: openssl rand -base64 32)",
    );
  }
  return {
    // nextCookies() must be last — lets better-auth read cookies in RSC/Server Actions
    extraPlugins: [nextCookies()],
    // Self-join private spaces the user holds a valid password cookie for.
    // user.create captures signup (device-independent); session.create covers
    // an existing user logging in with the cookie present.
    onSessionCreated: (userId, { cookieHeader }) =>
      joinPrivateSpacesFromCookies(userId, cookieHeader),
    onUserCreated: (userId, { cookieHeader }) => joinPrivateSpacesFromCookies(userId, cookieHeader),
    prisma,
    secret,
    ...(process.env.RESEND_API_KEY
      ? {
          resendApiKey: process.env.RESEND_API_KEY,
          ...(process.env.RESEND_FROM_EMAIL && { fromEmail: process.env.RESEND_FROM_EMAIL }),
        }
      : {}),
    ...(process.env.REDIS_URL
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

const getAuth = (): Auth => {
  if (!cachedAuth) {
    cachedAuth = createAuth(getAuthConfig());
  }
  return cachedAuth;
};

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

// React.cache() dedupes getSession within a single RSC request.
const getSession = cache(async () => {
  const headersList = await headers();

  try {
    const session = await auth.api.getSession({
      headers: headersList,
    });

    return session;
  } catch (error) {
    // Auth failures (DB down, misconfiguration) must not be silent — they
    // look identical to "logged out" without a log entry to diagnose.
    log.error({
      error: error instanceof Error ? error.message : String(error),
      message: "getSession failed",
    });
    return null;
  }
});

export { auth, getAuth, getSession };
