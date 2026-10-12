import { z } from "zod";

import type { TeamMember } from "@/types";

import { DEFAULT_MEMBER_TIMEZONE, fuzzyMatchTimezone } from "./timezones";
import { InvitationEmailSchema, TeamMemberInputSchema, UUIDSchema } from "./validation";

const NO_GROUP = "";

const memberFormSchema = TeamMemberInputSchema.extend({
  groupId: UUIDSchema.or(z.literal(NO_GROUP)),
});

const addMemberFormSchema = memberFormSchema.extend({
  email: InvitationEmailSchema.or(z.literal("")),
});

type MemberFormValues = z.input<typeof memberFormSchema>;

type AddMemberFormValues = z.input<typeof addMemberFormSchema>;

type MemberInput = Omit<TeamMember, "id" | "order" | "userId">;

type MemberDraft = Omit<MemberInput, "groupId"> & { groupId: string };

const toMemberFormValues = (member: TeamMember): MemberFormValues => ({
  groupId: member.groupId ?? NO_GROUP,
  name: member.name,
  timezone: fuzzyMatchTimezone(member.timezone) ?? DEFAULT_MEMBER_TIMEZONE,
  title: member.title,
  workingHoursEnd: member.workingHoursEnd,
  workingHoursStart: member.workingHoursStart,
});

const toMemberInput = ({
  groupId,
  name,
  timezone,
  title,
  workingHoursEnd,
  workingHoursStart,
}: MemberDraft): MemberInput => ({
  groupId: groupId === NO_GROUP ? undefined : groupId,
  name: name.trim(),
  timezone,
  title: title.trim(),
  workingHoursEnd,
  workingHoursStart,
});

export type { AddMemberFormValues, MemberFormValues, MemberInput };
export { addMemberFormSchema, memberFormSchema, NO_GROUP, toMemberFormValues, toMemberInput };
