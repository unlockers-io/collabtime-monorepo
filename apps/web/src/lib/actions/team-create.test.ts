import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTeamAction } from "./team-create-core";
import { createTestGuards, createTestMember, createTestTeamStore } from "./test-helpers";

type TeamCreateDeps = Parameters<typeof createTeamAction>[0];

const TEAM_ID = "770e8400-e29b-41d4-a716-446655440002";
const TEST_TIMEZONE = "America/New_York";

const harness = createTestTeamStore();
const guards = createTestGuards();
const countAdminTeams = vi.fn<TeamCreateDeps["countAdminTeams"]>();
const createSpace = vi.fn<TeamCreateDeps["createSpace"]>();
const deleteSpace = vi.fn<TeamCreateDeps["deleteSpace"]>();
const reportError = vi.fn<TeamCreateDeps["reportError"]>();
const storeTeam = vi.fn<TeamCreateDeps["storeTeam"]>();
const createTeam = createTeamAction({
  authenticate: guards.authenticate,
  countAdminTeams,
  createId: () => TEAM_ID,
  createMember: (overrides) => createTestMember({ id: "member-id", ...overrides }),
  createSpace,
  deleteSpace,
  grantMembership: harness.grantMembership,
  now: () => new Date("2026-01-01T00:00:00.000Z"),
  reportError,
  storeTeam,
});

const createdTeam = async () => {
  const team = await harness.readTeam(TEAM_ID);
  if (!team) {
    throw new Error("team contents were not stored");
  }
  return team;
};

describe("createTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.reset();
    guards.reset();
    countAdminTeams.mockResolvedValue(0);
    createSpace.mockResolvedValue();
    deleteSpace.mockResolvedValue();
    storeTeam.mockImplementation(harness.createTeamContents);
  });

  it.each(["", "   ", "a".repeat(101)])(
    "rejects invalid workspace names without writes: %s",
    async (name) => {
      expect(await createTeam(TEST_TIMEZONE, name)).toMatchObject({ success: false });
      expect(createSpace).not.toHaveBeenCalled();
      expect(storeTeam).not.toHaveBeenCalled();
    },
  );

  it("stores a trimmed name", async () => {
    await createTeam(TEST_TIMEZONE, "  Platform team  ");

    const team = await createdTeam();
    expect(team.name).toBe("Platform team");
  });

  it("requires a session before any write", async () => {
    guards.authenticate.mockResolvedValue({ error: "Authentication required", success: false });

    const result = await createTeam(TEST_TIMEZONE, "My workspace");

    expect(result).toEqual({ error: "Authentication required", success: false });
    expect(countAdminTeams).not.toHaveBeenCalled();
    expect(createSpace).not.toHaveBeenCalled();
  });

  it("creates the space, the creator's slot and their admin membership", async () => {
    expect(await createTeam(TEST_TIMEZONE, "My workspace")).toEqual({
      data: TEAM_ID,
      success: true,
    });

    expect(createSpace).toHaveBeenCalledWith("user-123", TEAM_ID);
    const team = await createdTeam();
    expect(team.members).toEqual([
      createTestMember({
        id: "member-id",
        name: "Test User",
        timezone: TEST_TIMEZONE,
        userId: "user-123",
      }),
    ]);
    expect(harness.findMembership("user-123", TEAM_ID)).toEqual({
      archivedAt: null,
      role: "ADMIN",
    });
    expect(deleteSpace).not.toHaveBeenCalled();
  });

  it("rolls the Space back without a membership when the contents write fails", async () => {
    storeTeam.mockResolvedValue({ ok: false, reason: "write-failed" });

    expect(await createTeam(TEST_TIMEZONE, "My workspace")).toEqual({
      error: "Failed to create team",
      success: false,
    });
    expect(deleteSpace).toHaveBeenCalledWith(TEAM_ID);
    expect(harness.findMembership("user-123", TEAM_ID)).toBeNull();
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "The new team's contents were not stored",
        reason: "write-failed",
        route: "actions/team-create",
        teamId: TEAM_ID,
      }),
    );
  });

  it("rolls the Space back when the admin membership write fails", async () => {
    harness.membershipStore.grant.mockRejectedValue(new Error("Postgres down"));

    expect(await createTeam(TEST_TIMEZONE, "My workspace")).toEqual({
      error: "Failed to create team",
      success: false,
    });
    expect(deleteSpace).toHaveBeenCalledWith(TEAM_ID);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Failed to populate the new team", teamId: TEAM_ID }),
    );
  });

  it("reports the original failure when the rollback also fails", async () => {
    storeTeam.mockResolvedValue({ ok: false, reason: "write-failed" });
    deleteSpace.mockRejectedValue(new Error("Postgres down"));

    const result = await createTeam(TEST_TIMEZONE, "My workspace");

    expect(result).toEqual({ error: "Failed to create team", success: false });
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to roll back the Space row of an unfinished team",
        route: "actions/team-create",
      }),
    );
  });

  it("allows the 50th administered workspace", async () => {
    countAdminTeams.mockResolvedValue(49);
    const result = await createTeam(TEST_TIMEZONE, "My workspace");
    expect(result.success).toBe(true);
    expect(countAdminTeams).toHaveBeenCalledWith("user-123");
  });

  it("rejects the 51st administered workspace before writing", async () => {
    countAdminTeams.mockResolvedValue(50);
    const result = await createTeam(TEST_TIMEZONE, "My workspace");
    expect(result).toEqual({ error: "You can administer up to 50 workspaces", success: false });
    expect(createSpace).not.toHaveBeenCalled();
    expect(storeTeam).not.toHaveBeenCalled();
  });
});
