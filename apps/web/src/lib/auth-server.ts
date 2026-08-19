import { envAuthConfig } from "@repo/auth/env-config";
import { createAuth, type Auth, type AuthConfig } from "@repo/auth/server";
import { prisma } from "@repo/db";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";

import { log } from "./observability";
import { redis } from "./redis";
import { joinPrivateSpacesFromCookies } from "./space-join";

let cachedAuth: Auth | null = null;

const getAuthConfig = (): AuthConfig => {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret === undefined || secret.length < 32) {
    throw new Error(
      "BETTER_AUTH_SECRET must be set to at least 32 characters (generate with: openssl rand -base64 32)",
    );
  }
  const config: AuthConfig = {
    ...envAuthConfig({ additionalAllowedHosts: ["collabtime.io", "www.collabtime.io"] }),
    extraPlugins: [nextCookies()],
    onSessionCreated: (userId, { cookieHeader }) =>
      joinPrivateSpacesFromCookies(userId, cookieHeader),
    onUserCreated: (userId, { cookieHeader }) => joinPrivateSpacesFromCookies(userId, cookieHeader),
    prisma,
    secret,
  };
  if (process.env.RESEND_API_KEY !== undefined && process.env.RESEND_API_KEY !== "") {
    config.resendApiKey = process.env.RESEND_API_KEY;
    if (process.env.RESEND_FROM_EMAIL !== undefined && process.env.RESEND_FROM_EMAIL !== "") {
      config.fromEmail = process.env.RESEND_FROM_EMAIL;
    }
  }
  if (process.env.REDIS_URL !== undefined && process.env.REDIS_URL !== "") {
    config.secondaryStorage = {
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
    };
  }
  return config;
};

const getAuth = (): Auth => {
  cachedAuth ??= createAuth(getAuthConfig());
  return cachedAuth;
};

const getSession = cache(async () => {
  const headersList = await headers();

  try {
    const session = await getAuth().api.getSession({
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

export { getAuth, getSession };
