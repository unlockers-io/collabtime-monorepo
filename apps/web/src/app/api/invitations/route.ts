import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { log, withEvlog } from "@/lib/observability";
import { readTeamSummary } from "@/lib/team-store";

const displayName = (name: string | null, email: string): string => {
  if (name !== null && name !== "") {
    return name;
  }
  const localPart = email.split("@")[0];
  return localPart !== undefined && localPart !== "" ? localPart : "Someone";
};

export const GET = withEvlog(async () => {
  try {
    const session = await getSession();

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
        const summary = await readTeamSummary(inv.teamId);

        return {
          id: inv.id,
          inviterName: displayName(inv.invitedBy.name, inv.invitedBy.email),
          memberId: inv.memberId,
          teamId: inv.teamId,
          teamName: summary !== null && summary.name !== "" ? summary.name : "Unknown Team",
        };
      }),
    );

    const validInvitations = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));

    return NextResponse.json({ invitations: validInvitations });
  } catch (error) {
    log.error({ error, message: "Failed to fetch invitations", route: "/api/invitations" });
    return NextResponse.json({ error: "Failed to fetch invitations" }, { status: 500 });
  }
});
