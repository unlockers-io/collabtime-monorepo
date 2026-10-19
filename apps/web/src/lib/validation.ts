import { z } from "zod";

import { TEAM_NAME_MAX_LENGTH } from "./limits";
import { COMMON_TIMEZONES } from "./timezones";

const UUIDSchema = z.uuid("Invalid ID format");

const workingHourSchema = (message: string) =>
  z.number({ error: message }).int(message).min(0, message).max(23, message);

const TeamMemberInputSchema = z.object({
  groupId: UUIDSchema.optional(),
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim(),
  timezone: z.enum(COMMON_TIMEZONES, {
    message: "Invalid timezone",
  }),
  title: z.string().max(100, "Title must be 100 characters or less").trim(),
  workingHoursEnd: workingHourSchema("Working hours end must be a whole hour from 0 to 23"),
  workingHoursStart: workingHourSchema("Working hours start must be a whole hour from 0 to 23"),
});

const TeamMemberUpdateSchema = TeamMemberInputSchema.partial();

const TeamGroupInputSchema = z.object({
  name: z
    .string()
    .min(1, "Group name is required")
    .max(50, "Group name must be 50 characters or less")
    .trim(),
});

const TeamGroupUpdateSchema = TeamGroupInputSchema.partial();

const PasswordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(100, "Password must be 100 characters or less");

const SpaceAccessPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be 128 characters or less");

export {
  PasswordSchema,
  SpaceAccessPasswordSchema,
  TeamGroupInputSchema,
  TeamGroupUpdateSchema,
  TeamMemberInputSchema,
  TeamMemberUpdateSchema,
  UUIDSchema,
};

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
export const InvitationEmailSchema = z.email("Invalid email address");
export const CuidSchema = z.cuid2("Invalid invitation ID");
export const TeamNameSchema = z
  .string()
  .trim()
  .min(1, "Workspace name is required")
  .max(TEAM_NAME_MAX_LENGTH, "Workspace name must be 100 characters or less");
