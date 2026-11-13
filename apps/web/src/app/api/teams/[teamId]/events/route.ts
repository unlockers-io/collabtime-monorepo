import { getSession } from "@/lib/auth-server";
import { log, withEvlog } from "@/lib/observability";
import { captureAccessCheck, findTeamSpace } from "@/lib/team-auth";
import { acquireTeamEventConnection } from "@/lib/team-event-admission";
import { createTeamEventsHandler } from "@/lib/team-event-handler";
import { isLiveSyncEnabled, teamEventHub } from "@/lib/team-events";

const handleEvents = createTeamEventsHandler({
  acquire: acquireTeamEventConnection,
  captureAccess: async (spaceId) => {
    const session = await getSession();
    const userId = session?.user.id;

    return { canView: await captureAccessCheck(spaceId, userId), userId };
  },
  enabled: isLiveSyncEnabled,
  findSpace: findTeamSpace,
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
