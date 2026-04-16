import { prisma } from "@repo/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth-server";
import { UUIDSchema } from "@/lib/validation";

const patchSchema = z.object({
  archived: z.boolean(),
});

type Params = {
  params: Promise<{ teamId: string }>;
};

// PATCH /api/teams/[teamId]/membership - Toggle archive state on caller's membership
export const PATCH = async (request: Request, { params }: Params) => {
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

    const existing = await prisma.membership.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    const updated = await prisma.membership.update({
      where: { userId_teamId: { userId: session.user.id, teamId } },
      data: { archivedAt: archived ? new Date() : null },
    });

    return NextResponse.json({
      membership: {
        teamId: updated.teamId,
        archivedAt: updated.archivedAt ? updated.archivedAt.toISOString() : null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    console.error("[Membership API] Error toggling archive:", error);
    return NextResponse.json({ error: "Failed to update membership" }, { status: 500 });
  }
};
