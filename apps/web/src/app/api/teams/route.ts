import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { log, withEvlog } from "@/lib/observability";
import { readTeamSummary } from "@/lib/team-store";

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

    // Owned spaces are returned alongside teams so the client can render the delete affordance.
    const ownedSpaces = await prisma.space.findMany({
      select: { id: true, teamId: true },
      where: {
        ownerId: session.user.id,
        teamId: { in: memberships.map((m) => m.teamId) },
      },
    });

    const ownedSpaceByTeamId = new Map(ownedSpaces.map((space) => [space.teamId, space.id]));

    const teams = await Promise.allSettled(
      memberships.map(async (membership) => {
        const summary = await readTeamSummary(membership.teamId);
        if (summary === null) {
          return null;
        }

        return {
          archivedAt: membership.archivedAt ? membership.archivedAt.toISOString() : null,
          memberCount: summary.memberCount,
          role: membership.role,
          spaceId: ownedSpaceByTeamId.get(membership.teamId) ?? null,
          teamId: membership.teamId,
          teamName: summary.name,
        };
      }),
    );

    const validTeams = teams.flatMap((result) =>
      result.status === "fulfilled" && result.value !== null ? [result.value] : [],
    );

    return NextResponse.json({ teams: validTeams });
  } catch (error) {
    log.error({ error, message: "Failed to fetch teams", route: "/api/teams" });
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
});
