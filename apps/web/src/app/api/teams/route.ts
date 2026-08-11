import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { log, withEvlog } from "@/lib/observability";
import { readTeamSummaries } from "@/lib/team-store";

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

    const teamIds = memberships.map((m) => m.teamId);

    const [summaries, ownedSpaces] = await Promise.all([
      readTeamSummaries(teamIds),
      prisma.space.findMany({
        select: { id: true, teamId: true },
        where: {
          ownerId: session.user.id,
          teamId: { in: teamIds },
        },
      }),
    ]);

    const ownedSpaceByTeamId = new Map(ownedSpaces.map((space) => [space.teamId, space.id]));

    const teams = memberships.flatMap((membership) => {
      const summary = summaries.get(membership.teamId);

      if (summary === undefined) {
        return [];
      }

      return [
        {
          archivedAt: membership.archivedAt ? membership.archivedAt.toISOString() : null,
          memberCount: summary.memberCount,
          role: membership.role,
          spaceId: ownedSpaceByTeamId.get(membership.teamId) ?? null,
          teamId: membership.teamId,
          teamName: summary.name,
        },
      ];
    });

    return NextResponse.json({ teams });
  } catch (error) {
    log.error({ error, message: "Failed to fetch teams", route: "/api/teams" });
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
});
