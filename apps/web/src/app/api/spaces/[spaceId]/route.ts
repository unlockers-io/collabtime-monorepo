import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth-server";
import { prisma, SubscriptionPlan } from "@repo/db";
import { subdomainSchema } from "@/lib/subdomain-validation";
import { invalidateSpaceCache, setSpaceCache } from "@/lib/subdomain-cache";

const updateSpaceSchema = z.object({
  subdomain: subdomainSchema.optional().nullable(),
  isPrivate: z.boolean().optional(),
  // Use separate flag to indicate password update intent
  updatePassword: z.boolean().optional(),
  accessPassword: z.string().min(4).max(128).optional().nullable(),
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
        hasPassword: Boolean(space.accessPassword),
        accessPassword: undefined,
      },
    });
  } catch (error) {
    console.error("[Spaces API] Error fetching space:", error);
    return NextResponse.json(
      { error: "Failed to fetch space" },
      { status: 500 }
    );
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

    // Check user subscription for PRO features
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    const isPro = user?.subscriptionPlan === SubscriptionPlan.PRO;

    // Validate PRO features
    if (updates.subdomain !== undefined && updates.subdomain !== null && !isPro) {
      return NextResponse.json(
        { error: "Custom subdomain requires PRO subscription" },
        { status: 402 }
      );
    }

    if (updates.isPrivate && !isPro) {
      return NextResponse.json(
        { error: "Private spaces require PRO subscription" },
        { status: 402 }
      );
    }

    // Check subdomain availability
    if (updates.subdomain) {
      const existingSubdomain = await prisma.space.findUnique({
        where: { subdomain: updates.subdomain },
      });

      if (existingSubdomain && existingSubdomain.id !== spaceId) {
        return NextResponse.json(
          { error: "This subdomain is already taken" },
          { status: 409 }
        );
      }
    }

    // Build update data
    const updateData: {
      subdomain?: string | null;
      isPrivate?: boolean;
      accessPassword?: string | null;
    } = {};

    // Handle subdomain update
    const oldSubdomain = space.subdomain;
    if (updates.subdomain !== undefined) {
      updateData.subdomain = updates.subdomain;
    }

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
        updateData.accessPassword = await bcrypt.hash(
          updates.accessPassword,
          10
        );
      }
    }

    const updatedSpace = await prisma.space.update({
      where: { id: spaceId },
      data: updateData,
    });

    // Invalidate old subdomain cache if changed
    if (oldSubdomain && oldSubdomain !== updatedSpace.subdomain) {
      await invalidateSpaceCache(oldSubdomain);
    }

    // Update cache with new subdomain if set
    if (updatedSpace.subdomain) {
      await setSpaceCache(updatedSpace.subdomain, {
        id: updatedSpace.id,
        teamId: updatedSpace.teamId,
        subdomain: updatedSpace.subdomain,
        isPrivate: updatedSpace.isPrivate,
      });
    }

    return NextResponse.json({
      space: {
        ...updatedSpace,
        // Return hasPassword boolean instead of masked value
        hasPassword: Boolean(updatedSpace.accessPassword),
        accessPassword: undefined,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    console.error("[Spaces API] Error updating space:", error);
    return NextResponse.json(
      { error: "Failed to update space" },
      { status: 500 }
    );
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
    return NextResponse.json(
      { error: "Failed to delete space" },
      { status: 500 }
    );
  }
};
