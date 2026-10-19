import { z } from "zod";

import { getEnv } from "./env";
import { log } from "./observability";
import { withTimeout } from "./promise-timeout";
import { createRedisClient, getRedis, isRedisConfigured } from "./redis";
import { UUIDSchema } from "./validation";

const TEAM_EVENTS_CHANNEL = "collabtime:team-events";
const TeamEventSchema = z.object({
  at: z.number(),
  kind: z.enum(["contents", "space", "deleted"]),
  teamId: UUIDSchema,
});

type TeamEvent = z.infer<typeof TeamEventSchema>;
type TeamHubEvent = TeamEvent | { kind: "reconnect" };
type TeamListener = (event: TeamHubEvent) => void;
type ReportError = typeof log.error;
type SubscriberEvents = {
  close: [];
  end: [];
  error: [Error];
  message: [string, string];
  ready: [];
  reconnecting: [];
};
type TeamSubscriber = {
  connect: () => Promise<void>;
  on: <T extends keyof SubscriberEvents>(
    event: T,
    listener: (...args: SubscriberEvents[T]) => void,
  ) => void;
  subscribe: (channel: string) => Promise<number>;
};

type TeamEventHubDeps = {
  createSubscriber: () => TeamSubscriber | null;
  reportError: ReportError;
};

const isLiveSyncEnabled = (): boolean =>
  isRedisConfigured() && getEnv("LIVE_SYNC_ENABLED") !== "false";

const createTeamEventHub = (deps: TeamEventHubDeps) => {
  const listeners = new Map<string, Set<TeamListener>>();
  const readiness = new Set<() => void>();
  let subscriber: TeamSubscriber | null = null;
  let ready = false;
  let generation = 0;
  let lastErrorAt = -Infinity;

  const reportConnectionError = (error: Error) => {
    if (Date.now() - lastErrorAt < 30_000) {
      return;
    }
    lastErrorAt = Date.now();
    deps.reportError({ error, message: "Live sync subscriber failed", route: "lib/team-events" });
  };

  const dispatch = (targets: Iterable<TeamListener>, event: TeamHubEvent) => {
    const snapshot = [...targets];
    for (const listener of snapshot) {
      try {
        listener(event);
      } catch (error) {
        deps.reportError({ error, message: "Live sync listener failed", route: "lib/team-events" });
      }
    }
  };

  const disconnected = () => {
    ready = false;
    generation += 1;
    const snapshot = [...listeners.values()];
    for (const targets of snapshot) {
      dispatch(targets, { kind: "reconnect" });
    }
  };

  const initialize = () => {
    if (subscriber) {
      return;
    }
    const connection = deps.createSubscriber();
    if (!connection) {
      return;
    }
    subscriber = connection;
    const connectionLost = () => {
      if (subscriber === connection) {
        disconnected();
      }
    };
    connection.on("error", reportConnectionError);
    connection.on("close", connectionLost);
    connection.on("end", () => {
      if (subscriber === connection) {
        disconnected();
        subscriber = null;
      }
    });
    connection.on("reconnecting", connectionLost);
    connection.on("message", (channel, message) => {
      if (subscriber !== connection || !ready || channel !== TEAM_EVENTS_CHANNEL) {
        return;
      }
      try {
        const event = TeamEventSchema.parse(JSON.parse(message));
        dispatch(listeners.get(event.teamId) ?? [], event);
      } catch (error) {
        deps.reportError({ error, message: "Invalid team event", route: "lib/team-events" });
      }
    });
    const subscribeConnection = async () => {
      if (subscriber !== connection) {
        return;
      }
      ready = false;
      const subscribingGeneration = ++generation;
      // Socket readiness precedes SUBSCRIBE acknowledgement, including on reconnect.
      try {
        await connection.subscribe(TEAM_EVENTS_CHANNEL);
        if (generation !== subscribingGeneration) {
          return;
        }
        ready = true;
        for (const resolve of readiness) {
          resolve();
        }
      } catch (error) {
        reportConnectionError(error instanceof Error ? error : new Error(String(error)));
      }
    };
    connection.on("ready", () => {
      void subscribeConnection();
    });
    const connect = async () => {
      try {
        await connection.connect();
      } catch (error) {
        reportConnectionError(error instanceof Error ? error : new Error(String(error)));
      }
    };
    void connect();
  };

  const waitUntilReady = async (): Promise<boolean> => {
    initialize();
    if (ready || !subscriber) {
      return ready;
    }
    let resolveReady: (() => void) | undefined;
    try {
      await withTimeout(
        new Promise<void>((resolve) => {
          resolveReady = resolve;
          readiness.add(resolve);
        }),
        2000,
      );
      return ready;
    } catch {
      return false;
    } finally {
      if (resolveReady) {
        readiness.delete(resolveReady);
      }
    }
  };

  const subscribe = (teamId: string, listener: TeamListener) => {
    const targets = listeners.get(teamId) ?? new Set<TeamListener>();
    listeners.set(teamId, targets);
    targets.add(listener);
    return () => {
      targets.delete(listener);
      if (targets.size === 0) {
        listeners.delete(teamId);
      }
    };
  };

  return { isReady: () => ready, subscribe, waitUntilReady };
};

type TeamEventPublisherDeps = {
  enabled: () => boolean;
  publish: (channel: string, message: string) => Promise<number>;
  reportError: ReportError;
};

const createTeamEventPublisher = (deps: TeamEventPublisherDeps) => {
  return async (teamId: string, kind: TeamEvent["kind"]): Promise<void> => {
    try {
      if (!deps.enabled()) {
        return;
      }
      const message = JSON.stringify({ at: Date.now(), kind, teamId });
      await withTimeout(deps.publish(TEAM_EVENTS_CHANNEL, message), 1000);
    } catch (error) {
      deps.reportError({
        error,
        message: "Failed to publish team event",
        route: "lib/team-events",
        teamId,
      });
    }
  };
};

const teamEventHub = createTeamEventHub({
  createSubscriber: () => {
    const connection = createRedisClient({
      autoResubscribe: false,
      enableAutoPipelining: false,
      maxRetriesPerRequest: null,
    });
    if (!connection) {
      return null;
    }
    return {
      connect: () => connection.connect(),
      on: (event, listener) => {
        connection.on(event, listener);
      },
      subscribe: async (channel: string) => Number(await connection.subscribe(channel)),
    };
  },
  reportError: log.error,
});

const publishTeamEvent = createTeamEventPublisher({
  enabled: isLiveSyncEnabled,
  publish: (channel, message) => getRedis().publish(channel, message),
  reportError: log.error,
});

export {
  createTeamEventHub,
  createTeamEventPublisher,
  isLiveSyncEnabled,
  publishTeamEvent,
  teamEventHub,
  TEAM_EVENTS_CHANNEL,
};
export type { TeamEvent, TeamHubEvent, TeamListener };
