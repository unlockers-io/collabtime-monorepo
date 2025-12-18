import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth-server";
import { prisma } from "@repo/db";
import Stripe from "stripe";

// Allowed origins for redirect URLs to prevent open redirect attacks
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://collabtime.io",
  "https://www.collabtime.io",
];

/**
 * Validate that a URL is safe to redirect to.
 * Only allows URLs from our allowed origins.
 */
const isValidRedirectUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return ALLOWED_ORIGINS.some(
      (origin) => parsed.origin === origin || parsed.origin === new URL(origin).origin
    );
  } catch {
    return false;
  }
};

const checkoutSchema = z.object({
  successUrl: z.string().url().refine(isValidRedirectUrl, {
    message: "Invalid redirect URL",
  }),
  cancelUrl: z.string().url().refine(isValidRedirectUrl, {
    message: "Invalid redirect URL",
  }),
});

const getStripeClient = (): Stripe => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }
  return new Stripe(secretKey, {
    apiVersion: "2025-02-24.acacia",
  });
};

export const POST = async (request: Request) => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { successUrl, cancelUrl } = checkoutSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const stripe = getStripeClient();

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: {
          userId: user.id,
        },
      });
      customerId = customer.id;

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: process.env.STRIPE_PRO_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: user.id,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
        },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    console.error("[Checkout] Error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
};
