import type { log } from "./observability";
import { withTimeout } from "./promise-timeout";
import type { TeamListener, TeamNotification } from "./team-events";

type AccessResult = "allowed" | "deleted" | "revoked";
type TeamEventStreamDeps = {
  checkAccess: () => Promise<AccessResult>;
  isReady: () => boolean;
  log: Pick<typeof log, "error" | "info">;
  principal: "guest" | "user";
  release: () => Promise<void>;
  signal: AbortSignal;
  startedAt: number;
  subscribe: (listener: TeamListener) => () => void;
  teamId: string;
};

const STREAM_LIFETIME_MS = 285_000;
const HEARTBEAT_MS = 25_000;
const encoder = new TextEncoder();
const HEARTBEAT = encoder.encode(": ping\n\n");
const ROUTE = "/api/teams/[teamId]/events";

const createTeamEventStream = (deps: TeamEventStreamDeps): Response => {
  const work = new AbortController();
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let closed = false;
  let initialized = false;
  let checking = false;
  let accessPending = true;
  let contentsPending = false;
  let eventsSent = 0;
  let unsubscribe: (() => void) | undefined;
  let removeAbortListener: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let lifetime: ReturnType<typeof setTimeout> | undefined;
  const context = { principal: deps.principal, route: ROUTE, teamId: deps.teamId };

  const release = async () => {
    try {
      await deps.release();
    } catch (error) {
      deps.log.error({ ...context, error, message: "Live sync cleanup failed" });
    }
  };

  const close = (reason: string, cancelled = false) => {
    if (closed) {
      return;
    }
    closed = true;
    work.abort();
    unsubscribe?.();
    clearInterval(heartbeat);
    clearTimeout(lifetime);
    removeAbortListener?.();
    void release();
    if (!cancelled) {
      if (reason === "slow-consumer") {
        controller.error(new Error("Live sync consumer is too slow"));
      } else {
        controller.close();
      }
    }
    deps.log.info({
      ...context,
      durationMs: Date.now() - deps.startedAt,
      eventsSent,
      message: "Live sync closed",
      reason,
    });
  };

  const enqueue = (bytes: Uint8Array): boolean => {
    if (closed) {
      return false;
    }
    if ((controller.desiredSize ?? 0) < bytes.byteLength) {
      close("slow-consumer");
      return false;
    }
    try {
      controller.enqueue(bytes);
      return true;
    } catch {
      close("enqueue-failed", true);
      return false;
    }
  };

  const send = (name: string, data: Record<string, string | number> = {}) => {
    const retry = name === "ready" ? "retry: 2000\n" : "";
    if (enqueue(encoder.encode(`${retry}event: ${name}\ndata: ${JSON.stringify(data)}\n\n`))) {
      eventsSent += 1;
    }
  };

  const reconnect = (reason: string) => {
    send("reconnect");
    close(reason);
  };

  const flush = async (): Promise<void> => {
    if (closed || checking) {
      return;
    }
    if (accessPending) {
      accessPending = false;
      checking = true;
      let access: AccessResult;
      try {
        access = await withTimeout(deps.checkAccess(), 2000, work.signal);
      } catch (error) {
        // oxlint-disable-next-line typescript/no-unnecessary-condition -- close() and handleEvent() reassign this while withTimeout is awaited; TypeScript keeps the pre-await narrowing
        if (!closed) {
          deps.log.error({ ...context, error, message: "Live sync access recheck failed" });
          reconnect("access-error");
        }
        return;
      } finally {
        checking = false;
      }
      // oxlint-disable-next-line typescript/no-unnecessary-condition -- close() and handleEvent() reassign this while withTimeout is awaited; TypeScript keeps the pre-await narrowing
      if (closed) {
        return;
      }
      if (access !== "allowed") {
        send(access);
        close(access);
        return;
      }
      // oxlint-disable-next-line typescript/no-unnecessary-condition -- close() and handleEvent() reassign this while withTimeout is awaited; TypeScript keeps the pre-await narrowing
      if (accessPending) {
        await flush();
        return;
      }
      if (initialized) {
        send("space");
      } else {
        initialized = true;
        send("ready", { teamId: deps.teamId });
        deps.log.info({ ...context, message: "Live sync opened" });
      }
    }
    if (initialized && contentsPending) {
      contentsPending = false;
      send("change", { at: Date.now(), kind: "contents" });
    }
  };

  const handleEvent = (event: TeamNotification) => {
    if (closed) {
      return;
    }
    if (event.kind === "reconnect") {
      reconnect("subscriber-disconnected");
      return;
    }
    if (event.kind === "contents") {
      contentsPending = true;
    } else {
      accessPending = true;
    }
    void flush();
  };

  const body = new ReadableStream<Uint8Array>(
    {
      cancel: () => {
        close("cancel", true);
      },
      start: (streamController) => {
        controller = streamController;
        const abort = () => {
          close("abort");
        };
        deps.signal.addEventListener("abort", abort, { once: true });
        removeAbortListener = () => {
          deps.signal.removeEventListener("abort", abort);
        };
        if (deps.signal.aborted) {
          abort();
          return;
        }
        unsubscribe = deps.subscribe(handleEvent);
        if (!deps.isReady()) {
          reconnect("subscriber-unavailable");
          return;
        }
        const remaining = deps.startedAt + STREAM_LIFETIME_MS - Date.now();
        if (remaining <= 0) {
          reconnect("lifetime");
          return;
        }
        heartbeat = setInterval(() => {
          if (initialized) {
            enqueue(HEARTBEAT);
          }
        }, HEARTBEAT_MS);
        lifetime = setTimeout(() => {
          reconnect("lifetime");
        }, remaining);
        void flush();
      },
    },
    new ByteLengthQueuingStrategy({ highWaterMark: 16 * 1024 }),
  );

  return new Response(body, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
};

export { createTeamEventStream };
export type { AccessResult, TeamEventStreamDeps };
