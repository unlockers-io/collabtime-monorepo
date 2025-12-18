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
  memberPassword: PasswordSchema,
});

const TeamAuthInputSchema = z.object({
  password: PasswordSchema,
});

const TeamPasswordUpdateSchema = z
  .object({
    currentAdminPassword: PasswordSchema,
    adminPassword: PasswordSchema.optional(),
    memberPassword: PasswordSchema.optional(),
  })
  .refine((data) => data.adminPassword || data.memberPassword, {
    message: "At least one password must be provided",
  });

type TeamMemberInput = z.infer<typeof TeamMemberInputSchema>;
type TeamMemberUpdate = z.infer<typeof TeamMemberUpdateSchema>;
type TeamGroupInput = z.infer<typeof TeamGroupInputSchema>;
type TeamGroupUpdate = z.infer<typeof TeamGroupUpdateSchema>;
type TeamCreateInput = z.infer<typeof TeamCreateInputSchema>;
type TeamAuthInput = z.infer<typeof TeamAuthInputSchema>;
type TeamPasswordUpdate = z.infer<typeof TeamPasswordUpdateSchema>;

export {
  PasswordSchema,
  TeamAuthInputSchema,
  TeamCreateInputSchema,
  TeamGroupInputSchema,
  TeamGroupUpdateSchema,
  TeamMemberInputSchema,
  TeamMemberUpdateSchema,
  TeamPasswordUpdateSchema,
  UUIDSchema,
  type TeamAuthInput,
  type TeamCreateInput,
  type TeamGroupInput,
  type TeamGroupUpdate,
  type TeamMemberInput,
  type TeamMemberUpdate,
  type TeamPasswordUpdate,
};
