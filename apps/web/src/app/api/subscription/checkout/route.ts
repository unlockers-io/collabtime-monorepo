import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth-server";
import { getStripe } from "@/lib/stripe";
import { redirectUrlSchema } from "@/lib/redirect-validation";
import { prisma } from "@repo/db";

const checkoutSchema = z.object({
  successUrl: redirectUrlSchema,
  cancelUrl: redirectUrlSchema,
});

const getProPriceId = (): string => {
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) {
    throw new Error("STRIPE_PRO_PRICE_ID environment variable is not set");
  }

  // Validate price ID format
  if (!priceId.startsWith("price_")) {
    throw new Error(
      `Invalid STRIPE_PRO_PRICE_ID format: "${priceId}". Must start with "price_"`
    );
  }

  return priceId;
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

    const stripe = getStripe();

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
          price: getProPriceId(),
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

    // Enhanced logging for Stripe errors
    console.error("[Checkout] Error:", error);

    // Check if it's a Stripe error
    if (error && typeof error === "object" && "type" in error) {
      const stripeError = error as {
        type: string;
        code?: string;
        param?: string;
      };
      console.error("[Checkout] Stripe Error Details:", {
        type: stripeError.type,
        code: stripeError.code,
        param: stripeError.param,
        priceId: process.env.STRIPE_PRO_PRICE_ID,
        stripeKeyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 8),
      });
    }

    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
};
