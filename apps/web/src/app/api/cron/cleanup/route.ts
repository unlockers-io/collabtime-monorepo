import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

export const GET = async (request: Request) => {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const [sessions, verifications] = await Promise.allSettled([
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.verification.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);

  const sessionsDeleted = sessions.status === "fulfilled" ? sessions.value.count : 0;
  const verificationsDeleted = verifications.status === "fulfilled" ? verifications.value.count : 0;

  if (sessions.status === "rejected") {
    console.error("Failed to clean up sessions:", sessions.reason);
  }
  if (verifications.status === "rejected") {
    console.error("Failed to clean up verifications:", verifications.reason);
  }

  return NextResponse.json({
    sessionsDeleted,
    verificationsDeleted,
  });
};
