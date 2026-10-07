import { prisma } from "@repo/db";

import { getSession } from "@/lib/auth-server";
import { getEnv } from "@/lib/env";
import { log, withEvlog } from "@/lib/observability";
import { isRedisConfigured } from "@/lib/redis";
import { acquireTeamEventConnection } from "@/lib/team-event-admission";
import { createTeamEventsHandler } from "@/lib/team-event-handler";
import { teamEventHub } from "@/lib/team-events";
import { captureAccessCheck } from "@/lib/workspace-access";

const handleEvents = createTeamEventsHandler({
  acquire: acquireTeamEventConnection,
  captureAccess: async (spaceId) => {
    const session = await getSession();
    const userId = session?.user.id;
    return { canView: await captureAccessCheck(spaceId, userId), userId };
  },
  enabled: () => isRedisConfigured() && getEnv("LIVE_SYNC_ENABLED") !== "false",
  findSpace: (teamId) =>
    prisma.space.findUnique({
      select: { accessPassword: true, id: true, isPrivate: true, teamId: true },
      where: { teamId },
    }),
  hub: teamEventHub,
  log,
});

export const maxDuration = 300;

// public-route: a space's live updates; captureAccessCheck admits anyone to a public space, members or password holders to a private one
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
