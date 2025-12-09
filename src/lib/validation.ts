import { z } from "zod";
import { COMMON_TIMEZONES } from "./timezones";

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
});

const TeamMemberUpdateSchema = TeamMemberInputSchema.partial();

const UUIDSchema = z.string().uuid("Invalid ID format");

type TeamMemberInput = z.infer<typeof TeamMemberInputSchema>;
type TeamMemberUpdate = z.infer<typeof TeamMemberUpdateSchema>;

export {
  TeamMemberInputSchema,
  TeamMemberUpdateSchema,
  UUIDSchema,
  type TeamMemberInput,
  type TeamMemberUpdate,
};
