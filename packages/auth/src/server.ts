import { stripe } from "@better-auth/stripe";
import type { PrismaClient } from "@repo/db";
import { SubscriptionPlan } from "@repo/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { BetterAuthPlugin } from "better-auth/types";
import Stripe from "stripe";

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
  stripe: {
    proPriceId: string;
    secretKey: string;
    webhookSecret: string;
  };
};

/**
 * Trusted origins for the auth system.
 * Includes localhost for development and the main production domains.
 */
const TRUSTED_ORIGINS = [
  "http://localhost:3000",
  "https://collabtime.io",
  "https://www.collabtime.io",
];

const createAuth = (prisma: PrismaClient, config: AuthConfig) => {
  const { betterAuth: betterAuthConfig, stripe: stripeConfig } = config;

  const stripeClient = new Stripe(stripeConfig.secretKey, {
    apiVersion: "2026-02-25.clover",
  });

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
        secure: process.env.NODE_ENV === "production",
      },
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

    plugins: [
      stripe({
        createCustomerOnSignUp: true,
        stripeClient,
        stripeWebhookSecret: stripeConfig.webhookSecret,
        subscription: {
          enabled: true,
          onSubscriptionCancel: async (params) => {
            const { subscription } = params;
            const userId = subscription.referenceId;

            if (!userId) { return; }

            // Downgrade user
            await prisma.user.update({
              data: { subscriptionPlan: SubscriptionPlan.FREE },
              where: { id: userId },
            });
          },
          onSubscriptionComplete: async (params) => {
            const { subscription } = params;
            const userId = subscription.referenceId;

            if (!userId) { return; }

            // Update user subscription plan
            await prisma.user.update({
              data: { subscriptionPlan: SubscriptionPlan.PRO },
              where: { id: userId },
            });
          },
          onSubscriptionUpdate: async ({ subscription }) => {
            if (!subscription.referenceId) { return; }

            const user = await prisma.user.findUnique({
              where: { id: subscription.referenceId },
            });

            if (!user) { return; }

            const plan =
              subscription.status === "active" || subscription.status === "trialing"
                ? SubscriptionPlan.PRO
                : SubscriptionPlan.FREE;

            await prisma.user.update({
              data: { subscriptionPlan: plan },
              where: { id: user.id },
            });
          },
          plans: [
            {
              limits: {
                customDomain: 1,
                privateSpaces: 10,
              },
              name: "PRO",
              priceId: stripeConfig.proPriceId,
            },
          ],
        },
      }),
      ...(config.extraPlugins ?? []),
    ],

    rateLimit: {
      enabled: true,
      max: 100,
      storage: "database",
      window: 60, // 1 minute
    },

    secret: betterAuthConfig.secret,

    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // Update session if older than 1 day
    },

    trustedOrigins: TRUSTED_ORIGINS,
  });
};

type Auth = ReturnType<typeof createAuth>;

export { createAuth };
export type { Auth };
