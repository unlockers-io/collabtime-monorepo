import type { PrismaClient } from "@repo/db";
import { log } from "@repo/observability";
import type { MailerConfig } from "@repo/transactional";
import { sendTransactionalEmail } from "@repo/transactional";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { BetterAuthPlugin } from "better-auth/types";

type SecondaryStorage = {
  delete: (key: string) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
};

type AuthLifecycleContext = {
  cookieHeader: string | null;
};

type AuthConfig = {
  extraPlugins?: Array<BetterAuthPlugin>;
  fromEmail?: string;
  onSessionCreated?: (userId: string, ctx: AuthLifecycleContext) => Promise<void>;
  onUserCreated?: (userId: string, ctx: AuthLifecycleContext) => Promise<void>;
  prisma: PrismaClient;
  resendApiKey?: string;
  resendReplyTo?: string;
  secondaryStorage?: SecondaryStorage;
  secret: string;
};

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

const createAuth = (config: AuthConfig) => {
  const {
    extraPlugins = [],
    fromEmail = "Collab Time <noreply@email.collabtime.io>",
    onSessionCreated,
    onUserCreated,
    prisma,
    resendApiKey,
    resendReplyTo,
    secondaryStorage,
    secret,
  } = config;

  const mailer: MailerConfig | null =
    resendApiKey !== undefined && resendApiKey !== ""
      ? { apiKey: resendApiKey, defaultReplyTo: resendReplyTo, from: fromEmail }
      : null;

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
      // Force the `Secure` cookie flag when WEB_APP_URL is HTTPS. The
      // dynamic-baseURL `protocol: "auto"` setting documents this as
      // automatic, but in practice under Next.js + a reverse proxy
      // (portless in dev, Vercel in prod), Better Auth doesn't reliably
      // see the HTTPS scheme via `x-forwarded-proto` or `request.url`,
      // so cookies end up without `Secure`.
      //
      // WEB_APP_URL is the explicit signal we already use everywhere:
      // set to `https://collabtime.web.localhost` in dev (.env.example)
      // and the prod web origin in prod; unset in CI (which runs on
      // plain http://127.0.0.1), so the gate naturally avoids the
      // HTTPS-in-CI footgun that bare `true` or NODE_ENV gating would
      // re-introduce.
      useSecureCookies: process.env.WEB_APP_URL?.startsWith("https://") === true,
    },

    basePath: "/api/auth",
    // Dynamic base URL: Better Auth derives the canonical origin from the
    // incoming request when its host matches `allowedHosts`. `allowedHosts`
    // also auto-extends `trustedOrigins`. See:
    // https://better-auth.com/docs/reference/options#dynamic-base-url
    baseURL: {
      allowedHosts: [
        "**.localhost",
        "localhost:*",
        "127.0.0.1:*",
        "collabtime.io",
        "www.collabtime.io",
        ...parseEnvList(process.env.AUTH_ALLOWED_HOSTS),
      ],
      fallback: "http://localhost:3000",
      protocol: "auto",
    },

    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),

    databaseHooks: {
      session: {
        create: {
          after: async (session, ctx) => {
            await onSessionCreated?.(session.userId, {
              cookieHeader: ctx?.headers?.get("cookie") ?? null,
            });
          },
        },
      },
      user: {
        create: {
          after: async (user, ctx) => {
            await onUserCreated?.(user.id, {
              cookieHeader: ctx?.headers?.get("cookie") ?? null,
            });
          },
        },
      },
    },

    emailAndPassword: {
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength: 12,
      onExistingUserSignUp: mailer
        ? async ({ user }, request) => {
            const origin = request?.headers.get("origin") ?? "";
            const result = await sendTransactionalEmail(
              {
                resetPasswordUrl: `${origin}/recover`,
                signInUrl: `${origin}/login`,
                type: "sign-up-attempt",
                userEmail: user.email,
                userId: user.id,
                username: user.name,
              },
              mailer,
            );
            if (!result.success) {
              log.error({
                error: result.error,
                message: "Failed to send sign-up attempt email",
                route: "auth",
              });
            }
          }
        : undefined,
      requireEmailVerification: Boolean(mailer),
      sendResetPassword: async ({ url, user }) => {
        if (!mailer) {
          return;
        }
        const result = await sendTransactionalEmail(
          {
            resetUrl: url,
            type: "password-reset",
            userEmail: user.email,
            userId: user.id,
            username: user.name,
          },
          mailer,
        );
        if (!result.success) {
          throw new Error(`Failed to send password reset email: ${result.error}`);
        }
      },
    },

    emailVerification: {
      autoSignInAfterVerification: true,
      callbackURL: "/",
      sendOnSignIn: true,
      sendVerificationEmail: async ({ url, user }) => {
        if (!mailer) {
          return;
        }
        const result = await sendTransactionalEmail(
          {
            type: "welcome",
            userEmail: user.email,
            userId: user.id,
            username: user.name,
            verificationUrl: url,
          },
          mailer,
        );
        if (!result.success) {
          throw new Error(`Failed to send verification email: ${result.error}`);
        }
      },
    },

    plugins: [...extraPlugins],

    rateLimit: {
      enabled:
        process.env.NODE_ENV === "production" &&
        (process.env.CI === undefined || process.env.CI === ""),
      max: 100,
      storage: secondaryStorage ? "secondary-storage" : "database",
      window: 60,
    },

    secret,

    ...(secondaryStorage && { secondaryStorage }),

    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
      expiresIn: 60 * 60 * 24 * 7,
      storeSessionInDatabase: true,
      updateAge: 60 * 60 * 24,
    },

    // `allowedHosts` already feeds `trustedOrigins`; the loopback set below
    // covers exact-origin checks for plain `http://localhost:PORT` requests
    // that wouldn't match a host pattern (Better Auth's exact-origin check
    // is string-equal for trustedOrigins).
    trustedOrigins: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      ...parseEnvList(process.env.TRUSTED_ORIGINS),
    ],

    user: {
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async ({ newEmail, url, user }) => {
          if (!mailer) {
            return;
          }
          const result = await sendTransactionalEmail(
            {
              changeUrl: url,
              currentEmail: user.email,
              newEmail,
              type: "change-email-confirmation",
              userId: user.id,
              username: user.name,
            },
            mailer,
          );
          if (!result.success) {
            throw new Error(`Failed to send change-email confirmation: ${result.error}`);
          }
        },
      },
    },
  });
};

type Auth = ReturnType<typeof createAuth>;

export { createAuth };
export type { Auth, AuthConfig };
