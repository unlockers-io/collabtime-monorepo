import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { hashPassword } from "@/lib/crypto";
import { log, withEvlog } from "@/lib/observability";
import { SpaceAccessPasswordSchema } from "@/lib/validation";

const updateSpaceSchema = z.object({
  isPrivate: z.boolean().optional(),
  // accessPassword only applied when updatePassword is set.
  accessPassword: SpaceAccessPasswordSchema.optional().nullable(),
  updatePassword: z.boolean().optional(),
});

type Params = {
  params: Promise<{ spaceId: string }>;
};

export const GET = withEvlog(async (_request: Request, { params }: Params) => {
  try {
    const { spaceId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const space = await prisma.space.findUnique({
      where: { id: spaceId },
    });

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    if (space.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      space: {
        ...space,
        // Expose hasPassword boolean, never the hash or a masked sentinel the client could echo back.
        accessPassword: undefined,
        hasPassword: Boolean(space.accessPassword),
      },
    });
  } catch (error) {
    log.error({ error, message: "Space operation failed", route: "/api/spaces/[spaceId]" });
    return NextResponse.json({ error: "Failed to fetch space" }, { status: 500 });
  }
});

export const PATCH = withEvlog(async (request: Request, { params }: Params) => {
  try {
    const { spaceId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const space = await prisma.space.findUnique({
      where: { id: spaceId },
    });

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    if (space.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const updates = updateSpaceSchema.parse(body);

    const updateData: {
      accessPassword?: string | null;
      isPrivate?: boolean;
    } = {};

    if (updates.isPrivate !== undefined) {
      updateData.isPrivate = updates.isPrivate;
    }

    // Only touch password when client opts in: masked "********" resubmit must not get hashed.
    if (updates.updatePassword) {
      if (updates.accessPassword === null) {
        updateData.accessPassword = null;
      } else if (updates.accessPassword) {
        updateData.accessPassword = await hashPassword(updates.accessPassword);
      }
    }

    const updatedSpace = await prisma.space.update({
      data: updateData,
      where: { id: spaceId },
    });

    return NextResponse.json({
      space: {
        ...updatedSpace,
        accessPassword: undefined,
        hasPassword: Boolean(updatedSpace.accessPassword),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    log.error({ error, message: "Space operation failed", route: "/api/spaces/[spaceId]" });
    return NextResponse.json({ error: "Failed to update space" }, { status: 500 });
  }
});

export const DELETE = withEvlog(async (_request: Request, { params }: Params) => {
  try {
    const { spaceId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const space = await prisma.space.findUnique({
      where: { id: spaceId },
    });

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    if (space.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.space.delete({
      where: { id: spaceId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ error, message: "Space operation failed", route: "/api/spaces/[spaceId]" });
    return NextResponse.json({ error: "Failed to delete space" }, { status: 500 });
  }
});
