import { db, space as spaceTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { verifyPassword } from "@/lib/crypto";
import { useLogger, withEvlog } from "@/lib/observability";
import { createSpaceAccessToken, SPACE_ACCESS_COOKIE_PREFIX } from "@/lib/space-access";
import { joinPrivateSpace } from "@/lib/space-join";
import { checkRateLimit } from "@/lib/space-rate-limit";

const verifyPasswordSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

type Params = {
  params: Promise<{ spaceId: string }>;
};

export const POST = withEvlog(async (request: Request, { params }: Params) => {
  try {
    const { spaceId } = await params;
    const body = await request.json();
    const { password } = verifyPasswordSchema.parse(body);

    // Brute-force brake before the expensive bcrypt compare. The 429 body is
    // generic so it does not leak whether the space exists or is private.
    const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
    const clientIp = forwardedFor.split(",")[0]?.trim() || "unknown";
    const { allowed } = await checkRateLimit(`space-verify:${spaceId}:${clientIp}`, 10, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const space = await db.query.space.findFirst({
      columns: {
        accessPassword: true,
        id: true,
        isPrivate: true,
        teamId: true,
      },
      where: eq(spaceTable.id, spaceId),
    });

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    // Always perform password comparison if space has a password set.
    // Prevents timing attacks that could reveal whether a space is private.
    const accessPassword = space.accessPassword;
    const hasPassword = Boolean(accessPassword);
    const isValid = accessPassword ? await verifyPassword(password, accessPassword) : false;

    if (!space.isPrivate || !hasPassword) {
      return NextResponse.json({ success: true, teamId: space.teamId });
    }

    if (!isValid) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    // Already-logged-in user verifying the password: the cookie hasn't been set
    // yet (this request sets it), so materialize the membership directly from
    // the just-verified space. Signup/login flows are covered by the auth hooks.
    const session = await getSession();
    if (session) {
      try {
        await joinPrivateSpace(session.user.id, space.teamId);
      } catch (joinError) {
        useLogger().error(joinError instanceof Error ? joinError : String(joinError), {
          route: "/api/spaces/[spaceId]/verify-password",
        });
      }
    }

    const accessToken = createSpaceAccessToken(spaceId);

    const response = NextResponse.json({
      success: true,
      teamId: space.teamId,
    });

    response.cookies.set(`${SPACE_ACCESS_COOKIE_PREFIX}${spaceId}`, accessToken, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
      secure: process.env.WEB_APP_URL?.startsWith("https://") === true,
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    useLogger().error(error instanceof Error ? error : String(error), {
      route: "/api/spaces/[spaceId]/verify-password",
    });
    return NextResponse.json({ error: "Failed to verify password" }, { status: 500 });
  }
});
