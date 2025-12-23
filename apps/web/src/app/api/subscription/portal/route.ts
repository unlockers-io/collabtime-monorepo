import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth-server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@repo/db";

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
      (origin) =>
        parsed.origin === origin || parsed.origin === new URL(origin).origin
    );
  } catch {
    return false;
  }
};

const portalSchema = z.object({
  returnUrl: z.string().url().refine(isValidRedirectUrl, {
    message: "Invalid redirect URL",
  }),
});

export const POST = async (request: Request) => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { returnUrl } = portalSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.stripeCustomerId) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    // Create billing portal session
    const stripe = getStripe();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    console.error("[Portal] Error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
};
