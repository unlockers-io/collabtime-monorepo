import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { verifyPassword } from "@/lib/crypto";
import { log, withEvlog } from "@/lib/observability";
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

    // Brute-force brake before bcrypt; generic 429 body does not leak space existence.
    const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
    const clientIp = forwardedFor.split(",")[0]?.trim() || "unknown";
    const { allowed } = await checkRateLimit(`space-verify:${spaceId}:${clientIp}`, 10, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const space = await prisma.space.findUnique({
      select: {
        accessPassword: true,
        id: true,
        isPrivate: true,
        teamId: true,
      },
      where: { id: spaceId },
    });

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    // Always compare when a password exists; prevents timing leaks about privacy.
    const accessPassword = space.accessPassword;
    const hasPassword = Boolean(accessPassword);
    const isValid =
      accessPassword !== null && accessPassword !== ""
        ? await verifyPassword(password, accessPassword)
        : false;

    if (!space.isPrivate || !hasPassword) {
      return NextResponse.json({ success: true, teamId: space.teamId });
    }

    if (!isValid) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    // Cookie is set by this request, so materialize membership directly; signup/login use auth hooks.
    const session = await getSession();
    if (session) {
      try {
        await joinPrivateSpace(session.user.id, space.teamId);
      } catch (joinError) {
        log.error({
          error: joinError,
          message: "Failed to join private space",
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
      maxAge: 60 * 60 * 24 * 7,
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
    log.error({
      error,
      message: "Failed to verify password",
      route: "/api/spaces/[spaceId]/verify-password",
    });
    return NextResponse.json({ error: "Failed to verify password" }, { status: 500 });
  }
});
