import { withTimeout } from "./promise-timeout";
import {
  isAccessLossStatus,
  LIVE_EVENTS,
  RECONNECT_DELAY_MS,
  RECONNECT_JITTER_MS,
  teamEventsUrl,
  type LiveEvent,
} from "./team-live-protocol";

type LiveSyncStatus = "connecting" | "live" | "offline";
type LiveObserver = {
  change: () => void;
  space: () => void;
  status: () => void;
  terminal: () => void;
};
type LiveConnectionDeps = {
  checkAccess: (url: string, signal: AbortSignal) => Promise<number>;
  createSource: (url: string) => {
    addEventListener: (event: string, listener: () => void) => void;
    close: () => void;
  };
  isVisible: () => boolean;
  onVisibilityChange: (callback: () => void) => () => void;
  random: () => number;
};

const BACKOFF_MS = [30_000, 60_000, 120_000, 300_000, 600_000];

const createTeamLiveConnection = (teamId: string, deps: LiveConnectionDeps) => {
  const url = teamEventsUrl(teamId);
  const observers = new Set<LiveObserver>();
  let status: LiveSyncStatus = "offline";
  let source: ReturnType<LiveConnectionDeps["createSource"]> | undefined;
  let accessProbe: AbortController | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let hiddenTimer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  let terminal = false;
  let disposed = false;

  const notify = (select: (observer: LiveObserver) => () => void) => {
    for (const listener of new Set([...observers].map(select))) {
      listener();
    }
  };
  const setStatus = (next: LiveSyncStatus) => {
    if (status !== next) {
      status = next;
      notify((observer) => observer.status);
    }
  };
  const stop = () => {
    accessProbe?.abort();
    accessProbe = undefined;
    source?.close();
    source = undefined;
    clearTimeout(retryTimer);
    retryTimer = undefined;
  };
  const retry = (planned: boolean, reconnect: () => void) => {
    stop();
    setStatus(planned ? "connecting" : "offline");
    const delay = planned
      ? RECONNECT_DELAY_MS + Math.floor(deps.random() * RECONNECT_JITTER_MS)
      : BACKOFF_MS[Math.min(failures++, BACKOFF_MS.length - 1)];
    if (!disposed && !terminal && deps.isVisible()) {
      retryTimer = setTimeout(reconnect, delay);
    }
  };
  const revoked = () => {
    terminal = true;
    stop();
    setStatus("offline");
    notify((observer) => observer.terminal);
  };
  const recoverAccess = async () => {
    const probe = new AbortController();
    accessProbe = probe;
    try {
      const responseStatus = await withTimeout(
        deps.checkAccess(url, probe.signal),
        5000,
        probe.signal,
      );
      if (!probe.signal.aborted && isAccessLossStatus(responseStatus)) {
        revoked();
      }
    } catch {
      // Network failures keep polling and the existing reconnect backoff.
    } finally {
      probe.abort();
      if (accessProbe === probe) {
        accessProbe = undefined;
      }
    }
  };
  const connect = () => {
    retryTimer = undefined;
    if (source || disposed || terminal || !deps.isVisible()) {
      return;
    }
    accessProbe?.abort();
    accessProbe = undefined;
    setStatus("connecting");
    let connection: ReturnType<LiveConnectionDeps["createSource"]>;
    try {
      connection = deps.createSource(url);
    } catch {
      retry(false, connect);
      return;
    }
    source = connection;
    const listen = (event: LiveEvent | "error", listener: () => void) => {
      connection.addEventListener(event, () => {
        if (source === connection && !disposed && !terminal) {
          listener();
        }
      });
    };
    listen(LIVE_EVENTS.ready, () => {
      failures = 0;
      setStatus("live");
      notify((observer) => observer.change);
    });
    listen(LIVE_EVENTS.change, () => {
      notify((observer) => observer.change);
    });
    listen(LIVE_EVENTS.space, () => {
      notify((observer) => observer.space);
    });
    listen(LIVE_EVENTS.reconnect, () => {
      retry(true, connect);
    });
    listen("error", () => {
      retry(false, connect);
      void recoverAccess();
    });
    listen(LIVE_EVENTS.revoked, revoked);
    listen(LIVE_EVENTS.deleted, revoked);
  };
  const visibilityChanged = () => {
    clearTimeout(hiddenTimer);
    if (deps.isVisible()) {
      if (retryTimer === undefined) {
        connect();
      }
      return;
    }
    clearTimeout(retryTimer);
    retryTimer = undefined;
    hiddenTimer = setTimeout(() => {
      stop();
      setStatus("offline");
    }, 10_000);
  };
  const unsubscribeVisibility = deps.onVisibilityChange(visibilityChanged);

  return {
    add: (observer: LiveObserver) => {
      observers.add(observer);
      if (observers.size === 1) {
        connect();
      } else if (status === "live") {
        observer.change();
      }
    },
    dispose: () => {
      disposed = true;
      stop();
      clearTimeout(hiddenTimer);
      unsubscribeVisibility();
      observers.clear();
    },
    getStatus: () => status,
    remove: (observer: LiveObserver) => {
      observers.delete(observer);
      return observers.size;
    },
  };
};

const createTeamLiveRegistry = (deps: LiveConnectionDeps) => {
  const connections = new Map<string, ReturnType<typeof createTeamLiveConnection>>();
  return {
    getStatus: (teamId: string): LiveSyncStatus =>
      connections.get(teamId)?.getStatus() ?? "offline",
    subscribe: (teamId: string, observer: LiveObserver) => {
      const connection = connections.get(teamId) ?? createTeamLiveConnection(teamId, deps);
      connections.set(teamId, connection);
      connection.add(observer);
      return () => {
        if (connection.remove(observer) === 0) {
          connection.dispose();
          connections.delete(teamId);
        }
      };
    },
  };
};

export { createTeamLiveRegistry };
export type { LiveConnectionDeps, LiveObserver, LiveSyncStatus };
