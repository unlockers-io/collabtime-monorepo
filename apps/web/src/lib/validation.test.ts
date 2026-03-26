import { describe, expect, it } from "vitest";

import {
  PasswordSchema,
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
    title: "Engineer",
    timezone: "America/New_York" as const,
    workingHoursStart: 9,
    workingHoursEnd: 17,
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

describe("PasswordSchema", () => {
  it("accepts valid password", () => {
    expect(PasswordSchema.safeParse("validpass").success).toBe(true);
  });

  it("rejects password shorter than 6 characters", () => {
    expect(PasswordSchema.safeParse("short").success).toBe(false);
  });

  it("rejects password longer than 100 characters", () => {
    expect(PasswordSchema.safeParse("a".repeat(101)).success).toBe(false);
  });

  it("accepts minimum length password", () => {
    expect(PasswordSchema.safeParse("123456").success).toBe(true);
  });
});
