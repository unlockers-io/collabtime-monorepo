import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { setSpaceCache } from "@/lib/subdomain-cache";

export const GET = async (request: Request) => {
  // Only allow middleware lookups
  const isMiddlewareLookup =
    request.headers.get("x-middleware-lookup") === "true";

  if (!isMiddlewareLookup) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const subdomain = searchParams.get("subdomain");

  if (!subdomain) {
    return NextResponse.json(
      { error: "Subdomain is required" },
      { status: 400 }
    );
  }

  try {
    const space = await prisma.space.findUnique({
      where: { subdomain },
      select: {
        id: true,
        teamId: true,
        subdomain: true,
        isPrivate: true,
      },
    });

    if (!space || !space.subdomain) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    // Populate Redis cache for future middleware lookups
    await setSpaceCache(space.subdomain, {
      id: space.id,
      teamId: space.teamId,
      subdomain: space.subdomain,
      isPrivate: space.isPrivate,
    });

    return NextResponse.json({ space });
  } catch (error) {
    console.error("[Spaces Lookup] Error:", error);
    return NextResponse.json(
      { error: "Failed to lookup space" },
      { status: 500 }
    );
  }
};
