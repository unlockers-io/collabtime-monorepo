import { getClientIp } from "./client-ip";
import type { log } from "./observability";
import type { Admission, AdmissionViewer } from "./team-event-admission";
import { createTeamEventStream, type AccessResult } from "./team-event-stream";
import type { TeamListener } from "./team-events";
import { ACCESS_LOSS_STATUS } from "./team-live-protocol";
import { UUIDSchema } from "./validation";
import type { AccessCheck, WorkspaceSpace } from "./workspace-access";

type CapturedAccess = { canView: AccessCheck; userId: string | undefined };
type TeamEventHandlerDeps = {
  acquire: (viewer: AdmissionViewer) => Promise<Admission>;
  captureAccess: (spaceId: string) => Promise<CapturedAccess>;
  enabled: () => boolean;
  findSpace: (teamId: string) => Promise<WorkspaceSpace | null>;
  hub: {
    isReady: () => boolean;
    subscribe: (teamId: string, listener: TeamListener) => () => void;
    waitUntilReady: () => Promise<boolean>;
  };
  log: Pick<typeof log, "error" | "info" | "warn">;
};

const errorResponse = (error: string, status: number) => Response.json({ error }, { status });

const createTeamEventsHandler = (deps: TeamEventHandlerDeps) => {
  return async (request: Request, teamId: string): Promise<Response> => {
    const startedAt = Date.now();
    const context = { route: "/api/teams/[teamId]/events", teamId };
    if (!UUIDSchema.safeParse(teamId).success) {
      return errorResponse("Invalid team ID", 400);
    }
    const accessOnly = request.method === "HEAD";
    try {
      if (!accessOnly && !deps.enabled()) {
        deps.log.warn({
          ...context,
          message: "Live sync unavailable",
          reason: "disabled-or-unconfigured",
        });
        return errorResponse("Live updates unavailable", 503);
      }
      const space = await deps.findSpace(teamId);
      if (!space) {
        return errorResponse("Team not found", ACCESS_LOSS_STATUS.deleted);
      }
      const { canView, userId } = await deps.captureAccess(space.id);
      if (!(await canView(space))) {
        return errorResponse("Forbidden", ACCESS_LOSS_STATUS.revoked);
      }
      if (accessOnly) {
        return new Response(null, { headers: { "Cache-Control": "no-store" }, status: 204 });
      }
      if (!(await deps.hub.waitUntilReady())) {
        deps.log.warn({ ...context, message: "Live sync unavailable", reason: "subscriber" });
        return errorResponse("Live updates unavailable", 503);
      }
      const admission = await deps.acquire({ ip: getClientIp(request), userId });
      if (!admission.allowed) {
        deps.log.warn({
          ...context,
          message: "Live sync admission refused",
          status: admission.status,
        });
        return errorResponse(
          admission.status === 429 ? "Too many live connections" : "Live updates unavailable",
          admission.status,
        );
      }
      const checkAccess = async (): Promise<AccessResult> => {
        const currentSpace = await deps.findSpace(teamId);
        if (!currentSpace || currentSpace.id !== space.id) {
          return "deleted";
        }
        return (await canView(currentSpace)) ? "allowed" : "revoked";
      };
      try {
        return createTeamEventStream({
          checkAccess,
          isReady: deps.hub.isReady,
          log: deps.log,
          principal: userId === undefined ? "guest" : "user",
          release: admission.release,
          signal: request.signal,
          startedAt,
          subscribe: (listener) => deps.hub.subscribe(teamId, listener),
          teamId,
        });
      } catch (error) {
        await admission.release();
        throw error;
      }
    } catch (error) {
      deps.log.error({ ...context, error, message: "Failed to open live sync" });
      return errorResponse("Live updates unavailable", 503);
    }
  };
};

export { createTeamEventsHandler };
export type { TeamEventHandlerDeps };
