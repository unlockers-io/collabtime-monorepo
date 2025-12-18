import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";
import { prisma } from "@repo/db";
import { SettingsClient } from "./client";

const SettingsPage = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      subscriptionPlan: true,
      stripeCustomerId: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const subscription = await prisma.subscription.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <SettingsClient
      user={{
        id: user.id,
        name: user.name ?? "",
        email: user.email,
        subscriptionPlan: user.subscriptionPlan,
      }}
      subscription={
        subscription
          ? {
              status: subscription.status,
              periodEnd: subscription.periodEnd?.toISOString() ?? null,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            }
          : null
      }
    />
  );
};

export default SettingsPage;
