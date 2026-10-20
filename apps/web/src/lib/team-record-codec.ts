import { z } from "zod";

import type { TeamRecord } from "@/types";

const GroupSchema = z.object({ id: z.string(), name: z.string(), order: z.int() });
const MemberSchema = z.object({
  groupId: z.string().optional(),
  id: z.string(),
  name: z.string(),
  order: z.int().optional(),
  timezone: z.string(),
  title: z.string(),
  userId: z.string().optional(),
  workingHoursEnd: z.int(),
  workingHoursStart: z.int(),
});
const TeamSchema = z.object({
  adminPasswordHash: z.string().optional(),
  createdAt: z.string(),
  groups: z.array(GroupSchema).default([]),
  id: z.uuid(),
  members: z.array(MemberSchema).default([]),
  name: z.string(),
});
const assertTimezone = (timezone: string): void => {
  const formatter = new Intl.DateTimeFormat("en", { timeZone: timezone });
  if (formatter.resolvedOptions().timeZone === "") {
    throw new Error("Invalid timezone");
  }
};
const decodeTeam = (teamId: string, contents: string): TeamRecord => {
  const team = TeamSchema.parse(JSON.parse(contents));
  if (team.id !== teamId) {
    throw new Error("Team key and record ID differ");
  }
  const groups = new Set(team.groups.map((group) => group.id));
  const members = team.members.map((member, index) => {
    assertTimezone(member.timezone);
    return Object.assign(member, {
      groupId:
        member.groupId !== undefined && groups.has(member.groupId) ? member.groupId : undefined,
      order: member.order ?? index,
    });
  });
  if (
    new Set(members.map((member) => member.id)).size !== members.length ||
    groups.size !== team.groups.length
  ) {
    throw new Error("Duplicate roster IDs");
  }
  return { ...team, members };
};
export { decodeTeam };
