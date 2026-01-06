import { z } from "zod";
import { COMMON_TIMEZONES } from "./timezones";

const UUIDSchema = z.uuid("Invalid ID format");

const TeamMemberInputSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim(),
  title: z.string().max(100, "Title must be 100 characters or less").trim(),
  timezone: z.enum(COMMON_TIMEZONES, {
    message: "Invalid timezone",
  }),
  workingHoursStart: z
    .number()
    .int()
    .min(0, "Working hours start must be 0-23")
    .max(23, "Working hours start must be 0-23"),
  workingHoursEnd: z
    .number()
    .int()
    .min(0, "Working hours end must be 0-23")
    .max(23, "Working hours end must be 0-23"),
  groupId: UUIDSchema.optional(),
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

const TeamCreateInputSchema = z.object({
  adminPassword: PasswordSchema,
});

const TeamAuthInputSchema = z.object({
  password: PasswordSchema,
});

export {
  PasswordSchema,
  TeamAuthInputSchema,
  TeamCreateInputSchema,
  TeamGroupInputSchema,
  TeamGroupUpdateSchema,
  TeamMemberInputSchema,
  TeamMemberUpdateSchema,
  UUIDSchema,
};
