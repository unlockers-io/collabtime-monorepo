import { stripe } from "@better-auth/stripe";
import type { PrismaClient } from "@repo/db";
import { SubscriptionPlan } from "@repo/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import Stripe from "stripe";

type AuthConfig = {
  stripe: {
    secretKey: string;
    webhookSecret: string;
    proPriceId: string;
  };
  betterAuth: {
    secret: string;
    url: string;
    webAppUrl: string;
  };
  resend?: {
    apiKey: string;
    fromEmail: string;
    replyTo?: string;
  };
};

const createAuth = (
  prisma: PrismaClient,
  config: AuthConfig
): ReturnType<typeof betterAuth> => {
  const { stripe: stripeConfig, betterAuth: betterAuthConfig } = config;

  const stripeClient = new Stripe(stripeConfig.secretKey, {
    apiVersion: "2025-02-24.acacia",
  });

  return betterAuth({
    database: prismaAdapter(prisma, {
      provider: "mysql",
    }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // Can enable later with Resend
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },

    plugins: [
      stripe({
        stripeClient,
        stripeWebhookSecret: stripeConfig.webhookSecret,
        createCustomerOnSignUp: true,
        subscription: {
          enabled: true,
          plans: [
            {
              name: "PRO",
              priceId: stripeConfig.proPriceId,
              limits: {
                customDomain: 1,
                privateSpaces: 10,
              },
            },
          ],
          onSubscriptionComplete: async (params) => {
            const { subscription } = params;
            console.log("[Stripe] Subscription completed:", subscription.id);

            const userId = subscription.referenceId;

            if (!userId) {
              console.error(
                "[Stripe] Subscription missing referenceId:",
                subscription.id
              );
              return;
            }

            // Update user subscription plan
            await prisma.user.update({
              where: { id: userId },
              data: { subscriptionPlan: SubscriptionPlan.PRO },
            });
          },
          onSubscriptionCancel: async (params) => {
            const { subscription } = params;
            console.log("[Stripe] Subscription canceled:", subscription.id);

            const userId = subscription.referenceId;

            if (!userId) {
              console.error(
                "[Stripe] Subscription missing referenceId:",
                subscription.id
              );
              return;
            }

            // Downgrade user
            await prisma.user.update({
              where: { id: userId },
              data: { subscriptionPlan: SubscriptionPlan.FREE },
            });
          },
          onSubscriptionUpdate: async ({ subscription }) => {
            console.log("[Stripe] Subscription updated:", subscription.id);

            // Guard against missing referenceId
            if (!subscription.referenceId) {
              console.error(
                "[Stripe] Subscription update missing referenceId:",
                subscription.id
              );
              return;
            }

            const user = await prisma.user.findUnique({
              where: { id: subscription.referenceId },
            });

            if (!user) {
              console.error(
                "[Stripe] User not found for subscription:",
                subscription.id
              );
              return;
            }

            const plan =
              subscription.status === "active" ||
              subscription.status === "trialing"
                ? SubscriptionPlan.PRO
                : SubscriptionPlan.FREE;

            await prisma.user.update({
              where: { id: user.id },
              data: { subscriptionPlan: plan },
            });
          },
        },
      }),
    ],

    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // Update session if older than 1 day
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
    },

    advanced: {
      cookiePrefix: "collabtime",
      defaultCookieAttributes: {
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        // Note: Domain restriction removed to support custom domains in the future
        // If you only need *.collabtime.io, you can re-add:
        // domain: process.env.NODE_ENV === "production" ? ".collabtime.io" : undefined,
      },
    },

    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["email"],
      },
    },

    rateLimit: {
      enabled: true,
      window: 60, // 1 minute
      max: 100, // 100 requests per minute
    },

    secret: betterAuthConfig.secret,
    baseURL: betterAuthConfig.url,
    basePath: "/api/auth",
    trustedOrigins: [
      "http://localhost:3000",
      "https://collabtime.io",
      "https://www.collabtime.io",
    ],
  });
};

type Auth = ReturnType<typeof createAuth>;

export { createAuth };
export type { Auth };
