import { prisma, type Space } from "@repo/db";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { hashPassword } from "@/lib/crypto";
import { log, withEvlog } from "@/lib/observability";
import { SpaceAccessPasswordSchema } from "@/lib/validation";

/**
 * The access mode, not the two columns behind it. Three independent optional
 * fields accepted 18 request shapes for three intents and let through
 * `isPrivate: true` with no password: a space showing a gate that no password
 * can open. A private space now always carries a credential.
 */
const updateSpaceSchema = z.discriminatedUnion("visibility", [
  z.object({ visibility: z.literal("public") }),
  z.object({
    password: SpaceAccessPasswordSchema.optional(),
    visibility: z.literal("private"),
  }),
]);

type Params = {
  params: Promise<{ spaceId: string }>;
};

type OwnedSpaceResult = { ok: false; response: NextResponse } | { ok: true; space: Space };

const loadOwnedSpace = async (spaceId: string): Promise<OwnedSpaceResult> => {
  const session = await getSession();

  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const space = await prisma.space.findUnique({
    where: { id: spaceId },
  });

  if (!space) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Space not found" }, { status: 404 }),
    };
  }

  if (space.ownerId !== session.user.id) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, space };
};

const spaceResponse = (space: Space): NextResponse =>
  NextResponse.json({
    space: {
      ...space,
      accessPassword: undefined,
      hasPassword: Boolean(space.accessPassword),
    },
  });

export const GET = withEvlog(async (_request: Request, { params }: Params) => {
  try {
    const { spaceId } = await params;
    const owned = await loadOwnedSpace(spaceId);

    if (!owned.ok) {
      return owned.response;
    }

    return spaceResponse(owned.space);
  } catch (error) {
    log.error({ error, message: "Space operation failed", route: "/api/spaces/[spaceId]" });
    return NextResponse.json({ error: "Failed to fetch space" }, { status: 500 });
  }
});

export const PATCH = withEvlog(async (request: Request, { params }: Params) => {
  try {
    const { spaceId } = await params;
    const owned = await loadOwnedSpace(spaceId);

    if (!owned.ok) {
      return owned.response;
    }

    const body = await request.json();
    const updates = updateSpaceSchema.parse(body);

    // Going public clears the hash rather than parking it, so a public space
    // never carries a live credential for a gate that is not shown.
    let updateData: { accessPassword: string | null; isPrivate: boolean };

    if (updates.visibility === "public") {
      updateData = { accessPassword: null, isPrivate: false };
    } else if (updates.password !== undefined) {
      updateData = { accessPassword: await hashPassword(updates.password), isPrivate: true };
    } else if (owned.space.accessPassword === null) {
      return NextResponse.json(
        { error: "A password is required to make this space private" },
        { status: 400 },
      );
    } else {
      updateData = { accessPassword: owned.space.accessPassword, isPrivate: true };
    }

    const updatedSpace = await prisma.space.update({
      data: updateData,
      where: { id: spaceId },
    });

    return spaceResponse(updatedSpace);
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
    const owned = await loadOwnedSpace(spaceId);

    if (!owned.ok) {
      return owned.response;
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
