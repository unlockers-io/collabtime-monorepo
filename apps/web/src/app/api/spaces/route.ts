import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { log, withEvlog } from "@/lib/observability";

export const GET = withEvlog(async () => {
  try {
    const session = await getSession();

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
