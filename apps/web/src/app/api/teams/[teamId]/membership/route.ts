import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { log, withEvlog } from "@/lib/observability";
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

    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { archived } = patchSchema.parse(body);

    const existing = await prisma.membership.findUnique({
      where: { userId_teamId: { teamId, userId: session.user.id } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    const updated = await prisma.membership.update({
      data: { archivedAt: archived ? new Date() : null },
      where: { userId_teamId: { teamId, userId: session.user.id } },
    });

    return NextResponse.json({
      membership: {
        archivedAt: updated.archivedAt ? updated.archivedAt.toISOString() : null,
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
    log.error({
      error,
      message: "Failed to update membership",
      route: "/api/teams/[teamId]/membership",
    });
    return NextResponse.json({ error: "Failed to update membership" }, { status: 500 });
  }
});
