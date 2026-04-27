// oxlint-disable no-console -- server-side diagnostic logging; TODO migrate to structured logger
import { prisma } from "@repo/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth-server";

const createSpaceSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
});

// GET /api/spaces - List user's spaces
export const GET = async () => {
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
    console.error("[Spaces API] Error fetching spaces:", error);
    return NextResponse.json({ error: "Failed to fetch spaces" }, { status: 500 });
  }
};

// POST /api/spaces - Create/claim a space
export const POST = async (request: Request) => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { teamId } = createSpaceSchema.parse(body);

    // Check if space already exists for this team
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

    // Create new space
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
    console.error("[Spaces API] Error creating space:", error);
    return NextResponse.json({ error: "Failed to create space" }, { status: 500 });
  }
};
