import { describe, expect, it } from "vitest";

import { createTestMember, createTestTeamRecord } from "./actions/test-helpers";
import { toPublicTeam } from "./public-team";

describe("toPublicTeam", () => {
  it("strips adminPasswordHash from output", () => {
    const team = createTestTeamRecord({ adminPasswordHash: "secret-hash" });
    const result = toPublicTeam(team, undefined);

    expect(result).not.toHaveProperty("adminPasswordHash");
  });

  it("preserves userId when it matches currentUserId", () => {
    const team = createTestTeamRecord({
      members: [createTestMember({ userId: "user-123" })],
    });

    const result = toPublicTeam(team, "user-123");
    expect(result.members[0]?.userId).toBe("user-123");
  });

  it("replaces other users' userIds with 'claimed'", () => {
    const team = createTestTeamRecord({
      members: [createTestMember({ userId: "other-user" })],
    });

    const result = toPublicTeam(team, "user-123");
    expect(result.members[0]?.userId).toBe("claimed");
  });

  it("omits userId for unclaimed members", () => {
    const team = createTestTeamRecord({
      members: [createTestMember({ userId: undefined })],
    });

    const result = toPublicTeam(team, "user-123");
    expect(result.members[0]).not.toHaveProperty("userId");
  });

  it("handles team with no members", () => {
    const team = createTestTeamRecord({ members: [] });
    const result = toPublicTeam(team, undefined);

    expect(result.members).toEqual([]);
  });
});
