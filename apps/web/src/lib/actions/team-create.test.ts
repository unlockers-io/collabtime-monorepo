import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTeamAction } from "./team-create";
import { createMockSession, createTestMember } from "./test-helpers";

type TeamCreateDeps = Parameters<typeof createTeamAction>[0];

let uuidCounter = 0;
const createTeamRecords = vi.fn<TeamCreateDeps["createTeamRecords"]>();
const deleteSpace = vi.fn<TeamCreateDeps["deleteSpace"]>();
const reportError = vi.fn<TeamCreateDeps["reportError"]>();
const requireAuth = vi.fn<TeamCreateDeps["requireAuth"]>();
const storeTeam = vi.fn<TeamCreateDeps["storeTeam"]>();
const createTeam = createTeamAction({
  createId: () => `test-uuid-${uuidCounter++}`,
  createMember: (overrides) => createTestMember({ id: "member-id", ...overrides }),
  createTeamRecords,
  deleteSpace,
  now: () => new Date("2026-01-01T00:00:00.000Z"),
  reportError,
  requireAuth,
  storeTeam,
});

const TEST_TIMEZONE = "America/New_York";

describe("createTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    createTeamRecords.mockResolvedValue();
    deleteSpace.mockResolvedValue();
    requireAuth.mockResolvedValue(createMockSession());
    storeTeam.mockResolvedValue({ ok: true });
  });

  it("returns error when not authenticated", async () => {
    requireAuth.mockRejectedValue(new Error("Unauthorized"));

    const result = await createTeam(TEST_TIMEZONE);

    expect(result).toEqual({ error: "Failed to create team", success: false });
  });

  it("creates space and membership in a transaction", async () => {
    await createTeam(TEST_TIMEZONE);

    expect(createTeamRecords).toHaveBeenCalledWith("user-123", "test-uuid-0");
  });

  it("populates redis cache with creator as first member", async () => {
    await createTeam(TEST_TIMEZONE);

    const storedTeam = storeTeam.mock.calls[0][1];

    expect(storedTeam.members).toHaveLength(1);
    expect(storedTeam.members[0]).toMatchObject({
      name: "Test User",
      order: 0,
      timezone: TEST_TIMEZONE,
      userId: "user-123",
      workingHoursEnd: 17,
      workingHoursStart: 9,
    });
  });

  it("does not report success when the team-contents write fails", async () => {
    storeTeam.mockResolvedValue({ ok: false, reason: "write-failed" });

    const result = await createTeam(TEST_TIMEZONE);

    expect(result).toEqual({ error: "Failed to create team", success: false });
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Space and membership committed but the team contents were not stored",
        reason: "write-failed",
        route: "actions/team-create",
      }),
    );
  });

  it("rolls back the Space row when the team-contents write fails", async () => {
    storeTeam.mockResolvedValue({ ok: false, reason: "write-failed" });

    await createTeam(TEST_TIMEZONE);

    expect(deleteSpace).toHaveBeenCalledWith("test-uuid-0");
  });

  it("reports the original failure when the rollback also fails", async () => {
    storeTeam.mockResolvedValue({ ok: false, reason: "write-failed" });
    deleteSpace.mockRejectedValue(new Error("Postgres down"));

    const result = await createTeam(TEST_TIMEZONE);

    expect(result).toEqual({ error: "Failed to create team", success: false });
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to roll back the Space row for a team with no contents",
        route: "actions/team-create",
      }),
    );
  });

  it("keeps the Space row when the team is created", async () => {
    await createTeam(TEST_TIMEZONE);

    expect(deleteSpace).not.toHaveBeenCalled();
  });

  it("returns the generated teamId on success", async () => {
    const result = await createTeam(TEST_TIMEZONE);

    expect(result).toEqual({ data: "test-uuid-0", success: true });
  });
});
