import { db, membership as membershipTable, space as spaceTable } from "@repo/db";
import { and, desc, eq, inArray } from "drizzle-orm";
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

    const memberships = await db.query.membership.findMany({
      orderBy: desc(membershipTable.createdAt),
      where: eq(membershipTable.userId, session.user.id),
    });

    // Owned spaces are returned alongside teams so the client can render the delete affordance.
    const teamIds = memberships.map((m) => m.teamId);
    const ownedSpaces =
      teamIds.length > 0
        ? await db.query.space.findMany({
            columns: { id: true, teamId: true },
            where: and(
              eq(spaceTable.ownerId, session.user.id),
              inArray(spaceTable.teamId, teamIds),
            ),
          })
        : [];

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
          archivedAt: membership.archivedAt ? new Date(membership.archivedAt).toISOString() : null,
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
