import type { PrismaClient } from "@repo/db";
import {
  sendPasswordResetEmail,
  sendSignUpAttemptEmail,
  sendWelcomeEmail,
} from "@repo/transactional";
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
 * Includes localhost for development (portless via OrbStack) and the main production domains.
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
  const { betterAuth: betterAuthConfig, resend } = config;

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
      minPasswordLength: 12,
      // requireEmailVerification activates Better Auth's enumeration-prevention
      // path — signing up with an already-registered email returns a synthetic
      // success response. onExistingUserSignUp below notifies the real account
      // holder so they're not left waiting for a verification email that won't
      // arrive. See better-auth docs "Email Enumeration Protection".
      onExistingUserSignUp: resend
        ? async ({ user }) => {
            const result = await sendSignUpAttemptEmail(
              {
                resetPasswordUrl: `${betterAuthConfig.webAppUrl}/recover`,
                signInUrl: `${betterAuthConfig.webAppUrl}/login`,
                userEmail: user.email,
                username: user.name,
              },
              {
                apiKey: resend.apiKey,
                defaultReplyTo: resend.replyTo,
                from: resend.fromEmail,
              },
            );
            if (!result.success) {
              // Don't throw — Better Auth's enumeration-prevention path needs
              // to return success regardless. Log so delivery failures don't
              // break the auth response.
              // oxlint-disable-next-line no-console -- temporary until a structured logger lands
              console.error("[Auth] Failed to send sign-up attempt email:", result.error);
            }
          }
        : undefined,
      // Gate on Resend availability — we physically can't send a verification
      // email without an API key, and requiring verification under that
      // condition would lock new users out.
      requireEmailVerification: Boolean(resend),
      // Always defined so the Better Auth endpoint accepts the request. The
      // actual send only happens when Resend is configured; without it we
      // succeed silently — the test/dev environment doesn't have email infra
      // but the user-visible flow (form submit → redirect) still works.
      sendResetPassword: async ({ url, user }) => {
        if (!resend) {
          return;
        }
        const result = await sendPasswordResetEmail(
          {
            resetUrl: url,
            userEmail: user.email,
            username: user.name,
          },
          {
            apiKey: resend.apiKey,
            defaultReplyTo: resend.replyTo,
            from: resend.fromEmail,
          },
        );
        if (!result.success) {
          throw new Error(`Failed to send password reset email: ${result.error}`);
        }
      },
    },

    emailVerification: {
      // Same no-op-without-Resend pattern as sendResetPassword above.
      sendVerificationEmail: async ({ url, user }) => {
        if (!resend) {
          return;
        }
        const result = await sendWelcomeEmail(
          {
            userEmail: user.email,
            username: user.name,
            verificationUrl: url,
          },
          {
            apiKey: resend.apiKey,
            defaultReplyTo: resend.replyTo,
            from: resend.fromEmail,
          },
        );
        if (!result.success) {
          throw new Error(`Failed to send verification email: ${result.error}`);
        }
      },
    },

    plugins: [...(config.extraPlugins ?? [])],

    // Fleet-canonical rate-limit shape. CI runs production builds but the
    // e2e suite hammers auth endpoints back-to-back across browsers; the
    // limiter would 429 the suite, so it's gated off when CI is set.
    // Falls back to database (persistent) instead of memory (non-deterministic
    // on serverless cold starts) when secondary storage isn't configured.
    rateLimit: {
      enabled: process.env.NODE_ENV === "production" && !process.env.CI,
      max: 100,
      storage: config.secondaryStorage ? "secondary-storage" : "database",
      window: 60,
    },

    secret: betterAuthConfig.secret,

    ...(config.secondaryStorage && { secondaryStorage: config.secondaryStorage }),

    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      storeSessionInDatabase: true,
      updateAge: 60 * 60 * 24, // Update session if older than 1 day
    },

    trustedOrigins: getTrustedOrigins,
  });
};

type Auth = ReturnType<typeof createAuth>;

export { createAuth };
export type { Auth };
