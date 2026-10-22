import { describe, expect, it } from "vitest";

import {
  addMemberFormSchema,
  memberFormSchema,
  NO_GROUP,
  toMemberFormValues,
  toMemberInput,
} from "./member-input";
import type { MemberFormValues } from "./member-input";

const GROUP_ID = "550e8400-e29b-41d4-a716-446655440000";

const values: MemberFormValues = {
  groupId: NO_GROUP,
  name: "Alice",
  timezone: "America/New_York",
  title: "Engineer",
  workingHoursEnd: 17,
  workingHoursStart: 9,
};

const issuesOf = (input: MemberFormValues) => {
  const result = memberFormSchema.safeParse(input);

  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("memberFormSchema", () => {
  it("accepts a member without a group", () => {
    expect(issuesOf(values)).toStrictEqual([]);
  });

  it("rejects a 101-character name", () => {
    expect(issuesOf({ ...values, name: "a".repeat(101) })).toStrictEqual([
      "Name must be 100 characters or less",
    ]);
  });

  it("rejects a 101-character title", () => {
    expect(issuesOf({ ...values, title: "a".repeat(101) })).toStrictEqual([
      "Title must be 100 characters or less",
    ]);
  });

  it("rejects a non-integer working hour", () => {
    expect(issuesOf({ ...values, workingHoursStart: 9.5 })).toStrictEqual([
      "Working hours start must be a whole hour from 0 to 23",
    ]);
  });

  it("rejects a group that is neither a UUID nor no group", () => {
    expect(issuesOf({ ...values, groupId: "engineering" })).toHaveLength(1);
    expect(issuesOf({ ...values, groupId: GROUP_ID })).toStrictEqual([]);
  });
});

describe("addMemberFormSchema", () => {
  it("accepts an empty invitation email and rejects a malformed one", () => {
    expect(addMemberFormSchema.safeParse({ ...values, email: "" }).success).toBe(true);
    expect(addMemberFormSchema.safeParse({ ...values, email: "alice@" }).success).toBe(false);
  });
});

describe("toMemberInput", () => {
  it("turns no group into an absent group", () => {
    expect(toMemberInput(values).groupId).toBeUndefined();
  });

  it("keeps a chosen group", () => {
    expect(toMemberInput({ ...values, groupId: GROUP_ID }).groupId).toBe(GROUP_ID);
  });

  it("trims the name and title", () => {
    const input = toMemberInput({ ...values, name: "  Alice  ", title: " Engineer " });
    expect(input).toMatchObject({ name: "Alice", title: "Engineer" });
  });
});

describe("toMemberFormValues", () => {
  it("fills an ungrouped member's form with no group and a supported timezone", () => {
    const formValues = toMemberFormValues({
      id: "member",
      name: "Alice",
      order: 0,
      timezone: "Not/AZone",
      title: "",
      workingHoursEnd: 17,
      workingHoursStart: 9,
    });

    expect(formValues.groupId).toBe(NO_GROUP);
    expect(memberFormSchema.safeParse(formValues).success).toBe(true);
  });
});
