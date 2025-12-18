import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth-server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@repo/db";

export const POST = async (request: Request) => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { returnUrl } = body;

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
    console.error("[Portal] Error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
};
