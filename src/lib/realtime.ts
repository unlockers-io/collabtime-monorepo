import "server-only";

import { Realtime, InferRealtimeEvents } from "@upstash/realtime";
import { redis } from "./redis";
import z from "zod/v4";

const TeamMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  timezone: z.string(),
  workingHoursStart: z.number(),
  workingHoursEnd: z.number(),
});

const schema = {
  team: {
    memberAdded: TeamMemberSchema,
    memberRemoved: z.object({ memberId: z.string() }),
    memberUpdated: TeamMemberSchema,
    membersReordered: z.object({ order: z.array(z.string()) }),
    nameUpdated: z.object({ name: z.string() }),
  },
};

const realtime = new Realtime({
  schema,
  redis,
  history: {
    maxLength: 10,
  },
});

type RealtimeEvents = InferRealtimeEvents<typeof realtime>;

export { realtime };
export type { RealtimeEvents };
