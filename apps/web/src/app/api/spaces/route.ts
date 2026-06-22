import { prisma } from "@repo/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth-server";
import { log, withEvlog } from "@/lib/observability";

const createSpaceSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
});

export const GET = withEvlog(async () => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const spaces = await prisma.space.findMany({
      orderBy: { createdAt: "desc" },
      where: { ownerId: session.user.id },
    });

    return NextResponse.json({ spaces });
  } catch (error) {
    log.error({ error, message: "Failed to fetch spaces", route: "/api/spaces" });
    return NextResponse.json({ error: "Failed to fetch spaces" }, { status: 500 });
  }
});

export const POST = withEvlog(async (request: Request) => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { teamId } = createSpaceSchema.parse(body);

    const existingSpace = await prisma.space.findUnique({
      where: { teamId },
    });

    if (existingSpace) {
      if (existingSpace.ownerId === session.user.id) {
        return NextResponse.json({ space: existingSpace });
      }
      return NextResponse.json(
        { error: "This team is already claimed by another user" },
        { status: 409 },
      );
    }

    const space = await prisma.space.create({
      data: {
        ownerId: session.user.id,
        teamId,
      },
    });

    return NextResponse.json({ space }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    log.error({ error, message: "Failed to create space", route: "/api/spaces" });
    return NextResponse.json({ error: "Failed to create space" }, { status: 500 });
  }
});
