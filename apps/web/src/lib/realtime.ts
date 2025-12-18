import "server-only";

import { Realtime, InferRealtimeEvents } from "@upstash/realtime";
import { getRedis } from "./redis";
import z from "zod/v4";

const TeamMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  timezone: z.string(),
  workingHoursStart: z.number(),
  workingHoursEnd: z.number(),
  groupId: z.string().optional(),
});

const TeamGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number(),
});

const schema = {
  team: {
    memberAdded: TeamMemberSchema,
    memberRemoved: z.object({ memberId: z.string() }),
    memberUpdated: TeamMemberSchema,
    membersReordered: z.object({ order: z.array(z.string()) }),
    nameUpdated: z.object({ name: z.string() }),
    groupCreated: TeamGroupSchema,
    groupUpdated: TeamGroupSchema,
    groupRemoved: z.object({ groupId: z.string() }),
    groupsReordered: z.object({ order: z.array(z.string()) }),
  },
} as const;

// Lazily initialized realtime instance
let _realtime: ReturnType<typeof createRealtime> | null = null;

const createRealtime = () =>
  new Realtime({
    schema,
    redis: getRedis(),
    history: {
      maxLength: 10,
    },
  });

/**
 * Get the Realtime instance (lazily initialized).
 * Use this instead of importing `realtime` directly.
 */
const getRealtime = () => {
  if (!_realtime) {
    _realtime = createRealtime();
  }
  return _realtime;
};

// Type inference from the schema
type RealtimeInstance = ReturnType<typeof createRealtime>;
type RealtimeEvents = InferRealtimeEvents<RealtimeInstance>;

// Legacy export for backwards compatibility - now a getter proxy
const realtime = new Proxy({} as RealtimeInstance, {
  get(_, prop) {
    const instance = getRealtime();
    const value = instance[prop as keyof RealtimeInstance];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(instance);
    }
    return value;
  },
});

export { realtime, getRealtime };
export type { RealtimeEvents };
