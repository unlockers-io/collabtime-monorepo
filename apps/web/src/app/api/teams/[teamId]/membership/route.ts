import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { log, withEvlog } from "@/lib/observability";

const patchSchema = z.object({
  archived: z.boolean(),
});

type Params = {
  params: Promise<{ teamId: string }>;
};

export const PATCH = withEvlog(async (request: Request, { params }: Params) => {
  try {
    const { teamId } = await params;

    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { archived } = patchSchema.parse(await request.json());
    const archivedAt = archived ? new Date() : null;

    // Scoped to the caller's own row, so the write is the membership check.
    const { count } = await prisma.membership.updateMany({
      data: { archivedAt },
      where: { teamId, userId: session.user.id },
    });

    if (count === 0) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    return NextResponse.json({
      membership: { archivedAt: archivedAt?.toISOString() ?? null, teamId },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    log.error({
      error,
      message: "Failed to update membership",
      route: "/api/teams/[teamId]/membership",
    });
    return NextResponse.json({ error: "Failed to update membership" }, { status: 500 });
  }
});
