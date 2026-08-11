import { createAuth, type Auth, type AuthConfig } from "@repo/auth/server";
import { prisma } from "@repo/db";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";

import { log } from "./observability";
import { redis } from "./redis";
import { joinPrivateSpacesFromCookies } from "./space-join";

const parseEnvList = (value: string | undefined): Array<string> => {
  if (value === undefined || value === "") {
    return [];
  }
  const result: Array<string> = [];
  for (const entry of value.split(",")) {
    const trimmed = entry.trim();
    if (trimmed.length > 0) {
      result.push(trimmed);
    }
  }
  return result;
};

const LOCALHOST_ALLOWED_HOSTS = [
  "**.localhost",
  "localhost:*",
  "127.0.0.1:*",
  "collabtime.io",
  "www.collabtime.io",
];

// Plain http://localhost:PORT origins won't match allowedHosts patterns.
const LOOPBACK_TRUSTED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

let cachedAuth: Auth | null = null;

const getAuthConfig = (): AuthConfig => {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret === undefined || secret.length < 32) {
    throw new Error(
      "BETTER_AUTH_SECRET must be set to at least 32 characters (generate with: openssl rand -base64 32)",
    );
  }
  return {
    allowedHosts: [...LOCALHOST_ALLOWED_HOSTS, ...parseEnvList(process.env.AUTH_ALLOWED_HOSTS)],
    extraPlugins: [nextCookies()],
    onSessionCreated: (userId, { cookieHeader }) =>
      joinPrivateSpacesFromCookies(userId, cookieHeader),
    onUserCreated: (userId, { cookieHeader }) => joinPrivateSpacesFromCookies(userId, cookieHeader),
    prisma,
    rateLimitEnabled:
      process.env.NODE_ENV === "production" &&
      (process.env.CI === undefined || process.env.CI === ""),
    secret,
    trustedOrigins: [...LOOPBACK_TRUSTED_ORIGINS, ...parseEnvList(process.env.TRUSTED_ORIGINS)],
    useSecureCookies: process.env.WEB_APP_URL?.startsWith("https://") === true,
    ...(process.env.RESEND_API_KEY !== undefined && process.env.RESEND_API_KEY !== ""
      ? {
          resendApiKey: process.env.RESEND_API_KEY,
          ...(process.env.RESEND_FROM_EMAIL !== undefined && process.env.RESEND_FROM_EMAIL !== ""
            ? { fromEmail: process.env.RESEND_FROM_EMAIL }
            : {}),
        }
      : {}),
    ...(process.env.REDIS_URL !== undefined && process.env.REDIS_URL !== ""
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
              await (ttl !== undefined && ttl !== 0
                ? redis.setex(key, ttl, value)
                : redis.set(key, value));
            },
          },
        }
      : {}),
  };
};

const getAuth = (): Auth => {
  cachedAuth ??= createAuth(getAuthConfig());
  return cachedAuth;
};

// oxlint-disable no-unsafe-type-assertion -- the Proxy impersonates Auth by design; its target is an empty stand-in and property access is forwarded dynamically.
const auth = new Proxy({} as Auth, {
  get(_, prop): unknown {
    const instance = getAuth();
    const value = instance[prop as keyof Auth];
    if (typeof value === "function") {
      return (value as (...args: Array<unknown>) => unknown).bind(instance);
    }
    return value;
  },
});
// oxlint-enable no-unsafe-type-assertion

const getSession = cache(async () => {
  const headersList = await headers();

  try {
    const session = await auth.api.getSession({
      headers: headersList,
    });

    return session;
  } catch (error) {
    log.error({
      error: error instanceof Error ? error.message : String(error),
      message: "getSession failed",
    });
    return null;
  }
});

export { auth, getAuth, getSession };
