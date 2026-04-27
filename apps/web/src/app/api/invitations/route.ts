// oxlint-disable no-console -- server-side diagnostic logging; TODO migrate to structured logger
import { prisma } from "@repo/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth-server";
import { redis } from "@/lib/redis";

const TeamCacheSchema = z.object({ name: z.string().optional() });

export const GET = async () => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invitations = await prisma.invitation.findMany({
      include: {
        invitedBy: {
          select: { email: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      where: {
        email: session.user.email,
        status: "PENDING",
      },
    });

    const results = await Promise.allSettled(
      invitations.map(async (inv) => {
        const data = await redis.get<string>(`team:${inv.teamId}`);
        const parsed = data
          ? TeamCacheSchema.safeParse(typeof data === "string" ? JSON.parse(data) : data)
          : null;
        const team = parsed?.success ? parsed.data : null;

        return {
          id: inv.id,
          inviterName: inv.invitedBy.name || inv.invitedBy.email.split("@")[0] || "Someone",
          memberId: inv.memberId,
          teamId: inv.teamId,
          teamName: team?.name || "Unknown Team",
        };
      }),
    );

    const validInvitations = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));

    return NextResponse.json({ invitations: validInvitations });
  } catch (error) {
    console.error("[Invitations API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch invitations" }, { status: 500 });
  }
};
