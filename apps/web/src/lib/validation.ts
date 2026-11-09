import { z } from "zod";

import {
  GROUP_NAME_MAX_LENGTH,
  MEMBER_NAME_MAX_LENGTH,
  MEMBER_TITLE_MAX_LENGTH,
  SPACE_PASSWORD_LENGTH,
  TEAM_NAME_MAX_LENGTH,
} from "./limits";
import { COMMON_TIMEZONES } from "./timezones";

const UUIDSchema = z.uuid("Invalid ID format");

const workingHourSchema = (message: string) =>
  z.number({ error: message }).int(message).min(0, message).max(23, message);

const TimezoneSchema = z.enum(COMMON_TIMEZONES, { message: "Invalid timezone" });

const TeamMemberInputSchema = z.object({
  groupId: UUIDSchema.optional(),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(MEMBER_NAME_MAX_LENGTH, `Name must be ${MEMBER_NAME_MAX_LENGTH} characters or less`),
  timezone: TimezoneSchema,
  title: z
    .string()
    .trim()
    .max(MEMBER_TITLE_MAX_LENGTH, `Title must be ${MEMBER_TITLE_MAX_LENGTH} characters or less`),
  workingHoursEnd: workingHourSchema("Working hours end must be a whole hour from 0 to 23"),
  workingHoursStart: workingHourSchema("Working hours start must be a whole hour from 0 to 23"),
});

const TeamMemberUpdateSchema = TeamMemberInputSchema.partial();

const TeamGroupInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Group name is required")
    .max(GROUP_NAME_MAX_LENGTH, `Group name must be ${GROUP_NAME_MAX_LENGTH} characters or less`),
});

const SpaceAccessPasswordSchema = z
  .string()
  .min(
    SPACE_PASSWORD_LENGTH.min,
    `Password must be at least ${SPACE_PASSWORD_LENGTH.min} characters`,
  )
  .max(
    SPACE_PASSWORD_LENGTH.max,
    `Password must be ${SPACE_PASSWORD_LENGTH.max} characters or less`,
  );

export {
  SpaceAccessPasswordSchema,
  TeamGroupInputSchema,
  TeamMemberInputSchema,
  TeamMemberUpdateSchema,
  TimezoneSchema,
  UUIDSchema,
};

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const InvitationEmailSchema = z
  .string()
  .transform(normalizeEmail)
  .pipe(z.email("Enter a valid email address"));

export const CuidSchema = z.cuid2("Invalid invitation ID");

export const TeamNameSchema = z
  .string()
  .trim()
  .min(1, "Workspace name is required")
  .max(TEAM_NAME_MAX_LENGTH, `Workspace name must be ${TEAM_NAME_MAX_LENGTH} characters or less`);
