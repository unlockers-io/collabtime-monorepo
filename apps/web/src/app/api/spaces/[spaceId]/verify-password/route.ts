import { prisma } from "@repo/db";
import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createSpaceAccessToken, SPACE_ACCESS_COOKIE_PREFIX } from "@/lib/space-access";

const verifyPasswordSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

type Params = {
  params: Promise<{ spaceId: string }>;
};

export const POST = async (request: Request, { params }: Params) => {
  try {
    const { spaceId } = await params;
    const body = await request.json();
    const { password } = verifyPasswordSchema.parse(body);

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

    // Always perform password comparison if space has a password set.
    // Prevents timing attacks that could reveal whether a space is private.
    const accessPassword = space.accessPassword;
    const hasPassword = Boolean(accessPassword);
    const isValid = accessPassword ? await compare(password, accessPassword) : false;

    if (!space.isPrivate || !hasPassword) {
      return NextResponse.json({ success: true, teamId: space.teamId });
    }

    if (!isValid) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
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
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    console.error("[Verify Password] Error:", error);
    return NextResponse.json({ error: "Failed to verify password" }, { status: 500 });
  }
};
