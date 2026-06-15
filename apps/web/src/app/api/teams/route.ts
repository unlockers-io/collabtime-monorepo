import { prisma } from "@repo/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth-server";
import { useLogger, withEvlog } from "@/lib/observability";
import { redis } from "@/lib/redis";

const TeamCacheSchema = z.object({
  members: z.array(z.unknown()).optional(),
  name: z.string().optional(),
});

export const GET = withEvlog(async () => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

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
        const data = await redis.get(`team:${membership.teamId}`);
        if (!data) {
          return null;
        }

        let parsed: z.infer<typeof TeamCacheSchema>;
        try {
          parsed = TeamCacheSchema.parse(JSON.parse(data));
        } catch {
          return null;
        }

        return {
          archivedAt: membership.archivedAt ? membership.archivedAt.toISOString() : null,
          memberCount: parsed.members?.length ?? 0,
          role: membership.role,
          spaceId: ownedSpaceByTeamId.get(membership.teamId) ?? null,
          teamId: membership.teamId,
          teamName: parsed.name || "",
        };
      }),
    );

    const validTeams = teams.flatMap((result) =>
      result.status === "fulfilled" && result.value !== null ? [result.value] : [],
    );

    return NextResponse.json({ teams: validTeams });
  } catch (error) {
    useLogger().error(error instanceof Error ? error : String(error), { route: "/api/teams" });
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
});
