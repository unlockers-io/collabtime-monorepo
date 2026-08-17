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

    const accessPassword = space.accessPassword;

    // A public space needs no grant, so say so before paying for a hash compare.
    if (!space.isPrivate) {
      return NextResponse.json({ success: true, teamId: space.teamId });
    }

    // Private with no credential used to answer 200 without ever setting the
    // access cookie, so the gate re-rendered and the guest looped forever. There
    // is no password that can open this space; say that instead of implying one.
    if (accessPassword === null || accessPassword === "") {
      return NextResponse.json(
        { error: "This space is private and has no access password. Ask the owner for access." },
        { status: 403 },
      );
    }

    if (!(await verifyPassword(password, accessPassword))) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

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

    const accessToken = createSpaceAccessToken(spaceId, accessPassword);

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
