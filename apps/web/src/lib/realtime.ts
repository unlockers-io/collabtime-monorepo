import "server-only";

import type { InferRealtimeEvents } from "@upstash/realtime";
import { Realtime } from "@upstash/realtime";
import z from "zod/v4";

import { getRedis } from "./redis";

const TeamMemberSchema = z.object({
  groupId: z.string().optional(),
  id: z.string(),
  name: z.string(),
  order: z.number(),
  timezone: z.string(),
  title: z.string(),
  workingHoursEnd: z.number(),
  workingHoursStart: z.number(),
});

const TeamGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number(),
});

const schema = {
  team: {
    groupCreated: TeamGroupSchema,
    groupRemoved: z.object({ groupId: z.string() }),
    groupsReordered: z.object({ order: z.array(z.string()) }),
    groupUpdated: TeamGroupSchema,
    memberAdded: TeamMemberSchema,
    memberRemoved: z.object({ memberId: z.string() }),
    membersImported: z.array(TeamMemberSchema),
    membersReordered: z.object({ order: z.array(z.string()) }),
    memberUpdated: TeamMemberSchema,
    nameUpdated: z.object({ name: z.string() }),
  },
} as const;

// Lazily initialized realtime instance
let cachedRealtime: ReturnType<typeof createRealtime> | null = null;

const createRealtime = () => {
  const redisInstance = getRedis();
  if (!redisInstance) {
    return null;
  }
  return new Realtime({
    history: {
      maxLength: 10,
    },
    redis: redisInstance,
    schema,
  });
};

/**
 * Get the Realtime instance (lazily initialized).
 * Use this instead of importing `realtime` directly.
 */
const getRealtime = () => {
  if (!cachedRealtime) {
    cachedRealtime = createRealtime();
  }
  return cachedRealtime;
};

// Type inference from the schema — use non-null type for the proxy facade
type RealtimeInstance = Exclude<ReturnType<typeof createRealtime>, null>;
type RealtimeEvents = InferRealtimeEvents<RealtimeInstance>;

// Lazy-initialized proxy — defers Realtime construction to first access
const realtime = new Proxy({} as RealtimeInstance, {
  get(_, prop) {
    const instance = getRealtime();
    if (!instance) {
      if (typeof prop === "string") {
        return () => Promise.resolve(null);
      }
      return undefined;
    }
    const value = instance[prop as keyof RealtimeInstance];
    if (typeof value === "function") {
      return (value as (...args: Array<unknown>) => unknown).bind(instance);
    }
    return value;
  },
});

export { realtime };
export type { RealtimeEvents };
