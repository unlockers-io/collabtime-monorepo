import { describe, expect, it } from "vitest";

import { normalizeTeamName, teamNameTag } from "./team-meta";

describe("normalizeTeamName", () => {
  it("trims the stored name", () => {
    expect(normalizeTeamName("  My Team  ")).toBe("My Team");
  });

  it("returns null for a blank name", () => {
    expect(normalizeTeamName("   ")).toBeNull();
  });

  it("returns null when the team has no stored summary", () => {
    expect(normalizeTeamName(undefined)).toBeNull();
  });
});

describe("teamNameTag", () => {
  it("keys the tag on the team id", () => {
    expect(teamNameTag("abc")).toBe("team-name:abc");
    expect(teamNameTag("abc")).not.toBe(teamNameTag("def"));
  });
});
