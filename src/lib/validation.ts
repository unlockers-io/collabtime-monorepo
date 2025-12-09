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

type TeamMemberInput = z.infer<typeof TeamMemberInputSchema>;
type TeamMemberUpdate = z.infer<typeof TeamMemberUpdateSchema>;
type TeamGroupInput = z.infer<typeof TeamGroupInputSchema>;
type TeamGroupUpdate = z.infer<typeof TeamGroupUpdateSchema>;

export {
  TeamGroupInputSchema,
  TeamGroupUpdateSchema,
  TeamMemberInputSchema,
  TeamMemberUpdateSchema,
  UUIDSchema,
  type TeamGroupInput,
  type TeamGroupUpdate,
  type TeamMemberInput,
  type TeamMemberUpdate,
};
