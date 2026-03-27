import type { PrismaClient } from "@repo/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { BetterAuthPlugin } from "better-auth/types";

type SecondaryStorage = {
  delete: (key: string) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
};

type AuthConfig = {
  betterAuth: {
    secret: string;
    url: string;
    webAppUrl: string;
  };
  // Inject framework-specific plugins (e.g. nextCookies()) at the call site;
  // must be last in the plugins array
  extraPlugins?: Array<BetterAuthPlugin>;
  resend?: {
    apiKey: string;
    fromEmail: string;
    replyTo?: string;
  };
  secondaryStorage?: SecondaryStorage;
};

/**
 * Trusted origins for the auth system.
 * Includes localhost for development (portless uses *.localhost:1355) and the main production domains.
 */
const TRUSTED_ORIGINS = [
  "http://localhost:3000",
  "https://collabtime.io",
  "https://www.collabtime.io",
];

/**
 * Build the trusted origins list, dynamically including the request's origin
 * if it matches *.localhost (portless dev URLs).
 */
const getTrustedOrigins = (request?: Request): Array<string> => {
  if (!request) {
    return TRUSTED_ORIGINS;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return TRUSTED_ORIGINS;
  }

  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) {
      return [...TRUSTED_ORIGINS, origin];
    }
  } catch {
    // invalid origin URL
  }

  return TRUSTED_ORIGINS;
};

const createAuth = (prisma: PrismaClient, config: AuthConfig) => {
  const { betterAuth: betterAuthConfig } = config;

  return betterAuth({
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["email"],
      },
    },

    advanced: {
      cookiePrefix: "collabtime",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax" as const,
      },
      useSecureCookies: betterAuthConfig.url.startsWith("https://"),
    },

    basePath: "/api/auth",
    baseURL: betterAuthConfig.url,

    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),

    emailAndPassword: {
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength: 8,
      requireEmailVerification: false, // Can enable later with Resend
    },

    plugins: [...(config.extraPlugins ?? [])],

    rateLimit: {
      enabled: !!config.secondaryStorage,
      max: 100,
      storage: config.secondaryStorage ? "secondary-storage" : "memory",
      window: 60, // 1 minute
    },

    secret: betterAuthConfig.secret,

    ...(config.secondaryStorage && { secondaryStorage: config.secondaryStorage }),

    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // Update session if older than 1 day
    },

    trustedOrigins: getTrustedOrigins,
  });
};

type Auth = ReturnType<typeof createAuth>;

export { createAuth };
export type { Auth };
