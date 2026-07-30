import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { log, withEvlog } from "@/lib/observability";

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

    const spaces = await prisma.space.findMany({
      select: { name: true, teamId: true },
      where: { teamId: { in: invitations.map((inv) => inv.teamId) } },
    });

    const nameByTeamId = new Map(spaces.map((space) => [space.teamId, space.name]));

    // An invitation outlives the space it points at, so a missing or blank name
    // stays a rendered row rather than a dropped one.
    const results = invitations.map((inv) => {
      const name = nameByTeamId.get(inv.teamId);

      return {
        id: inv.id,
        inviterName: displayName(inv.invitedBy.name, inv.invitedBy.email),
        memberId: inv.memberId,
        teamId: inv.teamId,
        teamName: name === undefined || name === "" ? "Unknown Team" : name,
      };
    });

    return NextResponse.json({ invitations: results });
  } catch (error) {
    log.error({ error, message: "Failed to fetch invitations", route: "/api/invitations" });
    return NextResponse.json({ error: "Failed to fetch invitations" }, { status: 500 });
  }
});
