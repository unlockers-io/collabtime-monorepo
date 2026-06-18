import { db, membership as membershipTable } from "@repo/db";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth-server";
import { useLogger, withEvlog } from "@/lib/observability";
import { UUIDSchema } from "@/lib/validation";

const patchSchema = z.object({
  archived: z.boolean(),
});

type Params = {
  params: Promise<{ teamId: string }>;
};

export const PATCH = withEvlog(async (request: Request, { params }: Params) => {
  try {
    const { teamId } = await params;

    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return NextResponse.json({ error: "Invalid team ID" }, { status: 400 });
    }

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { archived } = patchSchema.parse(body);

    const membershipWhere = and(
      eq(membershipTable.teamId, teamId),
      eq(membershipTable.userId, session.user.id),
    );

    const existing = await db.query.membership.findFirst({ where: membershipWhere });

    if (!existing) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(membershipTable)
      .set({ archivedAt: archived ? new Date().toISOString() : null })
      .where(membershipWhere)
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    return NextResponse.json({
      membership: {
        archivedAt: updated.archivedAt ? new Date(updated.archivedAt).toISOString() : null,
        teamId: updated.teamId,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    useLogger().error(error instanceof Error ? error : String(error), {
      route: "/api/teams/[teamId]/membership",
    });
    return NextResponse.json({ error: "Failed to update membership" }, { status: 500 });
  }
});
