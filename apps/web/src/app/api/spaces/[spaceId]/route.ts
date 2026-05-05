import { prisma } from "@repo/db";
import { hash } from "bcryptjs";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth-server";

const updateSpaceSchema = z.object({
  isPrivate: z.boolean().optional(),
  // Use separate flag to indicate password update intent
  accessPassword: z.string().min(4).max(128).optional().nullable(),
  updatePassword: z.boolean().optional(),
});

type Params = {
  params: Promise<{ spaceId: string }>;
};

// GET /api/spaces/[spaceId] - Get space details
export const GET = async (_request: Request, { params }: Params) => {
  try {
    const { spaceId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

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
        // Return hasPassword boolean instead of masked value to prevent sentinel value issues
        accessPassword: undefined,
        hasPassword: Boolean(space.accessPassword),
      },
    });
  } catch (error) {
    console.error("[Spaces API] Error fetching space:", error);
    return NextResponse.json({ error: "Failed to fetch space" }, { status: 500 });
  }
};

// PATCH /api/spaces/[spaceId] - Update space settings
export const PATCH = async (request: Request, { params }: Params) => {
  try {
    const { spaceId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

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

    // Build update data
    const updateData: {
      accessPassword?: string | null;
      isPrivate?: boolean;
    } = {};

    // Handle privacy setting
    if (updates.isPrivate !== undefined) {
      updateData.isPrivate = updates.isPrivate;
    }

    // Handle password update - only process if explicitly requested
    // This prevents the masked value "********" from being used
    if (updates.updatePassword) {
      if (updates.accessPassword === null) {
        // Explicitly clearing password
        updateData.accessPassword = null;
      } else if (updates.accessPassword) {
        // Setting new password
        updateData.accessPassword = await hash(updates.accessPassword, 10);
      }
    }

    const updatedSpace = await prisma.space.update({
      data: updateData,
      where: { id: spaceId },
    });

    return NextResponse.json({
      space: {
        ...updatedSpace,
        // Return hasPassword boolean instead of masked value
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
    console.error("[Spaces API] Error updating space:", error);
    return NextResponse.json({ error: "Failed to update space" }, { status: 500 });
  }
};

// DELETE /api/spaces/[spaceId] - Delete space
export const DELETE = async (_request: Request, { params }: Params) => {
  try {
    const { spaceId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

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
    console.error("[Spaces API] Error deleting space:", error);
    return NextResponse.json({ error: "Failed to delete space" }, { status: 500 });
  }
};
