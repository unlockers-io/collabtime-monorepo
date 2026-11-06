import { envAuthConfig } from "@repo/auth/env-config";
import { createAuth, type Auth, type AuthConfig } from "@repo/auth/server";
import { prisma } from "@repo/db";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";

import { getEnv } from "./env";
import { getMailerConfig } from "./mailer";
import { log } from "./observability";
import { getRedis, incrementWithExpiry, isRedisConfigured } from "./redis";
import { joinPrivateSpacesFromCookies } from "./space-join";

let cachedAuth: Auth | null = null;

const redisSecondaryStorage = (): NonNullable<AuthConfig["secondaryStorage"]> => {
  const redis = getRedis();

  return {
    delete: async (key: string) => {
      await redis.del(key);
    },
    get: (key: string) => redis.get(key),
    getAndDelete: (key: string) => redis.getdel(key),
    increment: incrementWithExpiry,
    set: async (key: string, value: string, ttl?: number) => {
      await (ttl !== undefined && ttl !== 0 ? redis.setex(key, ttl, value) : redis.set(key, value));
    },
  };
};

const getAuthConfig = (): AuthConfig => {
  const secret = getEnv("BETTER_AUTH_SECRET");

  if (secret === undefined) {
    throw new Error("BETTER_AUTH_SECRET must be set (generate with: openssl rand -base64 32)");
  }

  return {
    ...envAuthConfig({ additionalAllowedHosts: ["collabtime.io", "www.collabtime.io"] }),
    extraPlugins: [nextCookies()],
    mailer: getMailerConfig(),
    onSessionCreated: (userId, { cookieHeader }) =>
      joinPrivateSpacesFromCookies(userId, cookieHeader),
    onUserCreated: (userId, { cookieHeader }) => joinPrivateSpacesFromCookies(userId, cookieHeader),
    prisma,
    secondaryStorage: isRedisConfigured() ? redisSecondaryStorage() : undefined,
    secret,
  };
};

const getAuth = (): Auth => {
  cachedAuth ??= createAuth(getAuthConfig());

  return cachedAuth;
};

type AuthSession = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

type Session = Omit<AuthSession, "user"> & {
  user: Omit<AuthSession["user"], "name"> & { name: string | null };
};

const getSession = cache(async (): Promise<Session | null> => {
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
