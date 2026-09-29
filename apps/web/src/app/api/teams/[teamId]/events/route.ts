import { prisma } from "@repo/db";
import { cookies } from "next/headers";

import { getSession } from "@/lib/auth-server";
import { getEnv } from "@/lib/env";
import { log, withEvlog } from "@/lib/observability";
import { isRedisConfigured } from "@/lib/redis";
import { SPACE_ACCESS_COOKIE_PREFIX } from "@/lib/space-access";
import { acquireTeamEventConnection } from "@/lib/team-event-admission";
import { createTeamEventsHandler } from "@/lib/team-event-handler";
import { teamEventHub } from "@/lib/team-events";

const handleEvents = createTeamEventsHandler({
  acquire: acquireTeamEventConnection,
  captureAccess: async (spaceId) => {
    const [session, cookieStore] = await Promise.all([getSession(), cookies()]);
    return {
      token: cookieStore.get(`${SPACE_ACCESS_COOKIE_PREFIX}${spaceId}`)?.value,
      userId: session?.user.id,
    };
  },
  enabled: () => isRedisConfigured() && getEnv("LIVE_SYNC_ENABLED") !== "false",
  findSpace: (teamId) =>
    prisma.space.findUnique({
      select: { accessPassword: true, id: true, isPrivate: true, teamId: true },
      where: { teamId },
    }),
  hub: teamEventHub,
  isMember: async (teamId, userId) =>
    (await prisma.membership.findUnique({
      select: { id: true },
      where: { userId_teamId: { teamId, userId } },
    })) !== null,
  log,
});

export const maxDuration = 300;

// public-route: a space's live updates; canAccessSpace admits anyone to a public space, members or password holders to a private one
export const GET = withEvlog(
  async (
    request: Request,
    {
      params,
    }: {
      params: Promise<{ teamId: string }>;
    },
  ) => {
    const { teamId } = await params;
    return handleEvents(request, teamId);
  },
);

export const HEAD = GET;
