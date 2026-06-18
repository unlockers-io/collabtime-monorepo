import { db, space as spaceTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth-server";
import { hashPassword } from "@/lib/crypto";
import { useLogger, withEvlog } from "@/lib/observability";
import { SpaceAccessPasswordSchema } from "@/lib/validation";

const updateSpaceSchema = z.object({
  isPrivate: z.boolean().optional(),
  // accessPassword is only applied when updatePassword is set, so a PATCH that
  // omits the flag leaves the stored password untouched.
  accessPassword: SpaceAccessPasswordSchema.optional().nullable(),
  updatePassword: z.boolean().optional(),
});

type Params = {
  params: Promise<{ spaceId: string }>;
};

export const GET = withEvlog(async (_request: Request, { params }: Params) => {
  try {
    const { spaceId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const space = await db.query.space.findFirst({
      where: eq(spaceTable.id, spaceId),
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
        // Expose a boolean, never the hash — and never a masked sentinel the client could echo back.
        accessPassword: undefined,
        hasPassword: Boolean(space.accessPassword),
      },
    });
  } catch (error) {
    useLogger().error(error instanceof Error ? error : String(error), {
      route: "/api/spaces/[spaceId]",
    });
    return NextResponse.json({ error: "Failed to fetch space" }, { status: 500 });
  }
});

export const PATCH = withEvlog(async (request: Request, { params }: Params) => {
  try {
    const { spaceId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const space = await db.query.space.findFirst({
      where: eq(spaceTable.id, spaceId),
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

    // Only touch the password when the client explicitly opts in, so the masked
    // "********" value the form may resubmit never gets hashed and stored.
    if (updates.updatePassword) {
      if (updates.accessPassword === null) {
        updateData.accessPassword = null;
      } else if (updates.accessPassword) {
        updateData.accessPassword = await hashPassword(updates.accessPassword);
      }
    }

    const [updatedSpace] = await db
      .update(spaceTable)
      .set(updateData)
      .where(eq(spaceTable.id, spaceId))
      .returning();

    if (!updatedSpace) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

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
    useLogger().error(error instanceof Error ? error : String(error), {
      route: "/api/spaces/[spaceId]",
    });
    return NextResponse.json({ error: "Failed to update space" }, { status: 500 });
  }
});

export const DELETE = withEvlog(async (_request: Request, { params }: Params) => {
  try {
    const { spaceId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const space = await db.query.space.findFirst({
      where: eq(spaceTable.id, spaceId),
    });

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    if (space.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.delete(spaceTable).where(eq(spaceTable.id, spaceId));

    return NextResponse.json({ success: true });
  } catch (error) {
    useLogger().error(error instanceof Error ? error : String(error), {
      route: "/api/spaces/[spaceId]",
    });
    return NextResponse.json({ error: "Failed to delete space" }, { status: 500 });
  }
});
