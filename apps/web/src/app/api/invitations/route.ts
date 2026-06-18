import { db, invitation as invitationTable } from "@repo/db";
import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth-server";
import { useLogger, withEvlog } from "@/lib/observability";
import { redis } from "@/lib/redis";

const TeamCacheSchema = z.object({ name: z.string().optional() });

export const GET = withEvlog(async () => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invitations = await db.query.invitation.findMany({
      orderBy: desc(invitationTable.createdAt),
      where: and(
        eq(invitationTable.email, session.user.email),
        eq(invitationTable.status, "PENDING"),
      ),
      with: {
        user: {
          columns: { email: true, name: true },
        },
      },
    });

    const results = await Promise.allSettled(
      invitations.map(async (inv) => {
        const data = await redis.get(`team:${inv.teamId}`);
        const parsed = data ? TeamCacheSchema.safeParse(JSON.parse(data)) : null;
        const team = parsed?.success ? parsed.data : null;

        return {
          id: inv.id,
          inviterName: inv.user.name || inv.user.email.split("@")[0] || "Someone",
          memberId: inv.memberId,
          teamId: inv.teamId,
          teamName: team?.name || "Unknown Team",
        };
      }),
    );

    const validInvitations = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));

    return NextResponse.json({ invitations: validInvitations });
  } catch (error) {
    useLogger().error(error instanceof Error ? error : String(error), {
      route: "/api/invitations",
    });
    return NextResponse.json({ error: "Failed to fetch invitations" }, { status: 500 });
  }
});
