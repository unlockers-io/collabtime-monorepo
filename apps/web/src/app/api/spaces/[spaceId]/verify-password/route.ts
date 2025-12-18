import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@repo/db";
import { passwordVerificationLimiter, getClientIp } from "@/lib/rate-limit";
import {
  createSpaceAccessToken,
  SPACE_ACCESS_COOKIE_PREFIX,
} from "@/lib/space-access";

const verifyPasswordSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

type Params = {
  params: Promise<{ spaceId: string }>;
};

export const POST = async (request: Request, { params }: Params) => {
  try {
    const { spaceId } = await params;
    const clientIp = getClientIp(request);

    // Rate limit by IP + spaceId combination to prevent brute force attacks
    const rateLimitKey = `${clientIp}:${spaceId}`;
    const {
      success: rateLimitSuccess,
      remaining,
      reset,
    } = await passwordVerificationLimiter.limit(rateLimitKey);

    if (!rateLimitSuccess) {
      const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(reset),
          },
        }
      );
    }

    const body = await request.json();
    const { password } = verifyPasswordSchema.parse(body);

    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      select: {
        id: true,
        teamId: true,
        isPrivate: true,
        accessPassword: true,
      },
    });

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    // Always perform password comparison if space has a password set
    // This prevents timing attacks that could reveal whether a space is private
    const hasPassword = Boolean(space.accessPassword);
    const isValid = hasPassword
      ? await bcrypt.compare(password, space.accessPassword!)
      : false;

    // If not private or no password, allow access regardless of comparison result
    if (!space.isPrivate || !hasPassword) {
      return NextResponse.json({ success: true, teamId: space.teamId });
    }

    if (!isValid) {
      return NextResponse.json(
        { error: "Incorrect password" },
        {
          status: 401,
          headers: {
            "X-RateLimit-Remaining": String(remaining),
          },
        }
      );
    }

    // Create signed access token bound to the client IP
    const accessToken = await createSpaceAccessToken(spaceId, clientIp);

    // Create response with signed access cookie
    const response = NextResponse.json({
      success: true,
      teamId: space.teamId,
    });

    // Set a signed cookie to remember access for 7 days
    response.cookies.set(
      `${SPACE_ACCESS_COOKIE_PREFIX}${spaceId}`,
      accessToken,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      }
    );

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    console.error("[Verify Password] Error:", error);
    return NextResponse.json(
      { error: "Failed to verify password" },
      { status: 500 }
    );
  }
};
