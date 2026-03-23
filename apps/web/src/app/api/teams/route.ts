import { prisma } from "@repo/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth-server";
import { redis } from "@/lib/redis";
import type { Team } from "@/types";

export const GET = async () => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    const teams = await Promise.allSettled(
      memberships.map(async (membership) => {
        const data = await redis.get<string>(`team:${membership.teamId}`);
        if (!data) {
          return null;
        }

        const team = (typeof data === "string" ? JSON.parse(data) : data) as Team;

        return {
          teamId: membership.teamId,
          teamName: team.name || "",
          role: membership.role,
          memberCount: team.members?.length ?? 0,
        };
      }),
    );

    const validTeams = teams.flatMap((result) =>
      result.status === "fulfilled" && result.value !== null ? [result.value] : [],
    );

    return NextResponse.json({ teams: validTeams });
  } catch (error) {
    console.error("[Teams API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
};
