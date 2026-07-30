import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { log, withEvlog } from "@/lib/observability";

export const GET = withEvlog(async () => {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberships = await prisma.membership.findMany({
      orderBy: { createdAt: "desc" },
      where: { userId: session.user.id },
    });

    const spaces = await prisma.space.findMany({
      // Ids rather than Prisma's `_count`: that field trips no-underscore-dangle,
      // and member rows are one per person, so the count is small either way.
      select: {
        id: true,
        members: { select: { id: true } },
        name: true,
        ownerId: true,
        teamId: true,
      },
      where: { teamId: { in: memberships.map((m) => m.teamId) } },
    });

    const spaceByTeamId = new Map(spaces.map((space) => [space.teamId, space]));

    // A membership whose Space row is gone is dropped: the team page it links to
    // resolves through the same row and would 404.
    const teams = memberships.flatMap((membership) => {
      const space = spaceByTeamId.get(membership.teamId);

      if (space === undefined) {
        return [];
      }

      return [
        {
          archivedAt: membership.archivedAt ? membership.archivedAt.toISOString() : null,
          memberCount: space.members.length,
          role: membership.role,
          // Only owners get an id: the client renders the delete affordance from it.
          spaceId: space.ownerId === session.user.id ? space.id : null,
          teamId: membership.teamId,
          teamName: space.name,
        },
      ];
    });

    return NextResponse.json({ teams });
  } catch (error) {
    log.error({ error, message: "Failed to fetch teams", route: "/api/teams" });
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
});
