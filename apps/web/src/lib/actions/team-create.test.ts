import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTeamAction } from "./team-create-core";
import { createTestGuards, createTestMember } from "./test-helpers";

type Deps = Parameters<typeof createTeamAction>[0];
const guards = createTestGuards();
const persistTeam = vi.fn<Deps["persistTeam"]>();
const countAdminTeams = vi.fn<Deps["countAdminTeams"]>();
const createTeam = createTeamAction({
  authenticate: guards.authenticate,
  countAdminTeams,
  createId: () => "team-id",
  createMember: createTestMember,
  now: () => new Date("2026-01-01"),
  persistTeam,
  reportError: vi.fn<() => void>(),
});
beforeEach(() => {
  guards.reset();
  persistTeam.mockReset().mockResolvedValue();
  countAdminTeams.mockReset().mockResolvedValue(0);
});
describe("create team", () => {
  it.each(["", "   ", "a".repeat(101)])("rejects invalid names %s", async (name) => {
    expect(await createTeam("Europe/Berlin", name)).toMatchObject({ success: false });
    expect(persistTeam).not.toHaveBeenCalled();
  });
  it("requires a session", async () => {
    guards.authenticate.mockResolvedValue({ error: "Authentication required", success: false });
    expect(await createTeam("Europe/Berlin", "Team")).toMatchObject({ success: false });
    expect(persistTeam).not.toHaveBeenCalled();
  });
  it("persists the entire team with its claimed creator in one call", async () => {
    expect(await createTeam("Europe/Berlin", "  Team  ")).toEqual({
      data: "team-id",
      success: true,
    });
    expect(persistTeam).toHaveBeenCalledWith(
      "user-123",
      expect.objectContaining({
        members: [expect.objectContaining({ timezone: "Europe/Berlin", userId: "user-123" })],
        name: "Team",
      }),
    );
  });
  it("reports a transaction failure", async () => {
    persistTeam.mockRejectedValue(new Error("database unavailable"));
    expect(await createTeam("Europe/Berlin", "Team")).toEqual({
      error: "Failed to create team",
      success: false,
    });
  });
  it.each([49, 50])("enforces the administration limit at %i", async (count) => {
    countAdminTeams.mockResolvedValue(count);
    const result = await createTeam("Europe/Berlin", "Team");
    expect(result.success).toBe(count < 50);
    expect(persistTeam).toHaveBeenCalledTimes(count < 50 ? 1 : 0);
  });
});
