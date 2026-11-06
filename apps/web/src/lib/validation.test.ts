import { describe, expect, it } from "vitest";

import {
  TeamNameSchema,
  InvitationEmailSchema,
  CuidSchema,
  TeamGroupInputSchema,
  TeamMemberInputSchema,
  UUIDSchema,
} from "./validation";

describe("UUIDSchema", () => {
  it("accepts valid UUID", () => {
    expect(UUIDSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
  });

  it("rejects invalid UUID", () => {
    expect(UUIDSchema.safeParse("not-a-uuid").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(UUIDSchema.safeParse("").success).toBe(false);
  });
});

describe("TeamMemberInputSchema", () => {
  const validMember = {
    name: "Alice",
    timezone: "America/New_York" as const,
    title: "Engineer",
    workingHoursEnd: 17,
    workingHoursStart: 9,
  };

  it("accepts valid member input", () => {
    expect(TeamMemberInputSchema.safeParse(validMember).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(TeamMemberInputSchema.safeParse({ ...validMember, name: "" }).success).toBe(false);
  });

  it("rejects name over 100 characters", () => {
    expect(TeamMemberInputSchema.safeParse({ ...validMember, name: "a".repeat(101) }).success).toBe(
      false,
    );
  });

  it("rejects invalid timezone", () => {
    expect(
      TeamMemberInputSchema.safeParse({ ...validMember, timezone: "Invalid/Zone" }).success,
    ).toBe(false);
  });

  it("rejects working hours outside 0-23", () => {
    expect(TeamMemberInputSchema.safeParse({ ...validMember, workingHoursStart: -1 }).success).toBe(
      false,
    );
    expect(TeamMemberInputSchema.safeParse({ ...validMember, workingHoursEnd: 24 }).success).toBe(
      false,
    );
  });

  it("rejects non-integer working hours", () => {
    expect(
      TeamMemberInputSchema.safeParse({ ...validMember, workingHoursStart: 9.5 }).success,
    ).toBe(false);
  });

  it("accepts optional groupId as valid UUID", () => {
    const result = TeamMemberInputSchema.safeParse({
      ...validMember,
      groupId: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect(result.success).toBe(true);
  });

  it("trims name whitespace", () => {
    const result = TeamMemberInputSchema.safeParse({ ...validMember, name: "  Alice  " });
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.name).toBe("Alice");
    }
  });
});

describe("TeamGroupInputSchema", () => {
  it("accepts valid group name", () => {
    expect(TeamGroupInputSchema.safeParse({ name: "Engineering" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(TeamGroupInputSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects name over 50 characters", () => {
    expect(TeamGroupInputSchema.safeParse({ name: "a".repeat(51) }).success).toBe(false);
  });

  it("trims whitespace", () => {
    const result = TeamGroupInputSchema.safeParse({ name: "  Design  " });
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.name).toBe("Design");
    }
  });
});

it("validates invitation IDs, email and workspace names", () => {
  expect(CuidSchema.safeParse("cmf12345678901234567890123").success).toBe(true);
  expect(CuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(false);
  expect(InvitationEmailSchema.parse(" Person@Example.com ")).toBe("person@example.com");
  expect(InvitationEmailSchema.safeParse("invalid@").success).toBe(false);
  expect(TeamNameSchema.parse("  Team  ")).toBe("Team");
  expect(TeamNameSchema.safeParse(" ").success).toBe(false);
  expect(TeamNameSchema.safeParse("a".repeat(101)).success).toBe(false);
});
