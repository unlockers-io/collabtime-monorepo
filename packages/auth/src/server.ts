import type { PrismaClient } from "@repo/db";
import { log } from "@repo/observability";
import {
  sendChangeEmailConfirmation,
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

// Raw request cookie header forwarded to lifecycle callbacks so the app side can
// run domain side effects (e.g. private-space self-join) without this package
// importing any domain models.
type AuthLifecycleContext = {
  cookieHeader: string | null;
};

type AuthConfig = {
  // Inject framework-specific plugins (e.g. nextCookies()) at the call site;
  // must be last in the plugins array
  extraPlugins?: Array<BetterAuthPlugin>;
  fromEmail?: string;
  // Fired after Better Auth persists a new session (login, and verification
  // auto-sign-in). Implemented at the web call site; failures must be swallowed
  // there since this runs inside Better Auth's create flow.
  onSessionCreated?: (userId: string, ctx: AuthLifecycleContext) => Promise<void>;
  // Fired after Better Auth persists a new user (signup). Captures intent tied
  // to the user row, so it survives the cross-device email-verification step.
  onUserCreated?: (userId: string, ctx: AuthLifecycleContext) => Promise<void>;
  prisma: PrismaClient;
  resendApiKey?: string;
  resendReplyTo?: string;
  secondaryStorage?: SecondaryStorage;
  secret: string;
};

const parseEnvList = (value: string | undefined): Array<string> => {
  if (!value) {
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
      // plain http://127.0.0.1) — so the gate naturally avoids the
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
        // Local dev (portless `collabtime.web.localhost` is two labels
        // under `.localhost`, so `**` is needed). Plain loopback ports
        // cover CI and direct-port access.
        "**.localhost",
        "localhost:*",
        "127.0.0.1:*",
        // Production marketing + app origins.
        "collabtime.io",
        "www.collabtime.io",
        // Vercel previews + any extra prod hosts come from env so this
        // file doesn't hardcode deployment domains.
        ...parseEnvList(process.env.AUTH_ALLOWED_HOSTS),
      ],
      fallback: "http://localhost:3000",
      protocol: "auto",
    },

    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),

    // Domain side effects run via injected callbacks (see AuthConfig). user.create
    // fires at signup (no session yet under requireEmailVerification, so this is
    // the device-independent capture point); session.create fires on login and
    // verification auto-sign-in. The cookie header lets the app side read the
    // space-access cookie that travels with the signup/login request.
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
      // requireEmailVerification activates Better Auth's enumeration-prevention
      // path — signing up with an already-registered email returns a synthetic
      // success response. onExistingUserSignUp below notifies the real account
      // holder so they're not left waiting for a verification email that won't
      // arrive. See better-auth docs "Email Enumeration Protection".
      onExistingUserSignUp: resendApiKey
        ? async ({ user }, request) => {
            const origin = request?.headers.get("origin") ?? "";
            const result = await sendSignUpAttemptEmail(
              {
                resetPasswordUrl: `${origin}/recover`,
                signInUrl: `${origin}/login`,
                userEmail: user.email,
                userId: user.id,
                username: user.name,
              },
              { apiKey: resendApiKey, defaultReplyTo: resendReplyTo, from: fromEmail },
            );
            if (!result.success) {
              // Don't throw — Better Auth's enumeration-prevention path needs
              // to return success regardless. Log so delivery failures don't
              // break the auth response.
              log.error({
                error: result.error,
                message: "Failed to send sign-up attempt email",
                route: "auth",
              });
            }
          }
        : undefined,
      // Gate on Resend availability — we physically can't send a verification
      // email without an API key, and requiring verification under that
      // condition would lock new users out.
      requireEmailVerification: Boolean(resendApiKey),
      // Always defined so the Better Auth endpoint accepts the request. The
      // actual send only happens when Resend is configured; without it we
      // succeed silently — the test/dev environment doesn't have email infra
      // but the user-visible flow (form submit → redirect) still works.
      sendResetPassword: async ({ url, user }) => {
        if (!resendApiKey) {
          return;
        }
        const result = await sendPasswordResetEmail(
          {
            resetUrl: url,
            userEmail: user.email,
            userId: user.id,
            username: user.name,
          },
          { apiKey: resendApiKey, defaultReplyTo: resendReplyTo, from: fromEmail },
        );
        if (!result.success) {
          throw new Error(`Failed to send password reset email: ${result.error}`);
        }
      },
    },

    emailVerification: {
      // The link is the login: clicking it verifies the address AND signs in
      // the clicking device. Tradeoff accepted (2026-06-12 fleet decision) —
      // simpler than the retired pending-screen flow, at the cost of the
      // session landing on whichever device opens the link.
      autoSignInAfterVerification: true,
      // Where Better Auth's verify-email handler redirects after token
      // exchange — the app root serves signed-in users directly.
      callbackURL: "/",
      // Unverified sign-in attempts still 403, but get a fresh verification
      // link alongside it so the login form can say "we just sent a new one".
      sendOnSignIn: true,
      // Same no-op-without-Resend pattern as sendResetPassword above.
      sendVerificationEmail: async ({ url, user }) => {
        if (!resendApiKey) {
          return;
        }
        const result = await sendWelcomeEmail(
          {
            userEmail: user.email,
            userId: user.id,
            username: user.name,
            verificationUrl: url,
          },
          { apiKey: resendApiKey, defaultReplyTo: resendReplyTo, from: fromEmail },
        );
        if (!result.success) {
          throw new Error(`Failed to send verification email: ${result.error}`);
        }
      },
    },

    plugins: [...extraPlugins],

    // Fleet-canonical rate-limit shape. CI runs production builds but the
    // e2e suite hammers auth endpoints back-to-back across browsers; the
    // limiter would 429 the suite, so it's gated off when CI is set.
    // Falls back to database (persistent) instead of memory (non-deterministic
    // on serverless cold starts) when secondary storage isn't configured.
    rateLimit: {
      enabled: process.env.NODE_ENV === "production" && !process.env.CI,
      max: 100,
      storage: secondaryStorage ? "secondary-storage" : "database",
      window: 60,
    },

    secret,

    ...(secondaryStorage && { secondaryStorage }),

    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      storeSessionInDatabase: true,
      updateAge: 60 * 60 * 24, // Update session if older than 1 day
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
        // Two-step flow: sendChangeEmailConfirmation goes to the CURRENT email
        // for consent. When the link is clicked, Better Auth re-invokes
        // emailVerification.sendVerificationEmail (the signup-verification hook
        // above) targeting the NEW email to confirm mailbox ownership. Same
        // no-op-without-Resend pattern as the other hooks.
        sendChangeEmailConfirmation: async ({ newEmail, url, user }) => {
          if (!resendApiKey) {
            return;
          }
          const result = await sendChangeEmailConfirmation(
            {
              changeUrl: url,
              currentEmail: user.email,
              newEmail,
              userId: user.id,
              username: user.name,
            },
            { apiKey: resendApiKey, defaultReplyTo: resendReplyTo, from: fromEmail },
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
