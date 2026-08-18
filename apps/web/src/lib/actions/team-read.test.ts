import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTeamReadActions } from "./team-read";
import { createMockSession, createTestTeamRecord, VALID_UUID } from "./test-helpers";

type TeamReadDeps = Parameters<typeof createTeamReadActions>[0];

const findSpace = vi.fn<TeamReadDeps["findSpace"]>();
const getAccessToken = vi.fn<TeamReadDeps["getAccessToken"]>();
const getSession = vi.fn<TeamReadDeps["getSession"]>();
const getTeamRole = vi.fn<TeamReadDeps["getTeamRole"]>();
const readTeamRecord = vi.fn<TeamReadDeps["readTeamRecord"]>();
const readTeamSummary = vi.fn<TeamReadDeps["readTeamSummary"]>();
const reportError = vi.fn<TeamReadDeps["reportError"]>();
const verifyAccessToken = vi.fn<TeamReadDeps["verifyAccessToken"]>();
const { getPublicTeam, getTeamMembershipRole, getTeamName, validateTeam } = createTeamReadActions({
  findSpace,
  getAccessToken,
  getSession,
  getTeamRole,
  readTeamRecord,
  readTeamSummary,
  reportError,
  verifyAccessToken,
});

describe("getPublicTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue(null);
    getTeamRole.mockResolvedValue(null);
    getAccessToken.mockResolvedValue(undefined);
  });

  it("returns error when space not found", async () => {
    findSpace.mockResolvedValue(null);

    const result = await getPublicTeam(VALID_UUID);

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("blocks private team access for guests without an access cookie", async () => {
    findSpace.mockResolvedValue({
      accessPassword: null,
      id: "space-1",
      isPrivate: true,
    });

    const result = await getPublicTeam(VALID_UUID);

    expect(result).toEqual({ error: "This team is private", success: false });
  });

  it("allows private team access for members via their membership", async () => {
    const team = createTestTeamRecord();
    findSpace.mockResolvedValue({
      accessPassword: null,
      id: "space-1",
      isPrivate: true,
    });
    getSession.mockResolvedValue(createMockSession());
    getTeamRole.mockResolvedValue({ role: "MEMBER", userId: "user-123" });
    readTeamRecord.mockResolvedValue(team);

    const result = await getPublicTeam(VALID_UUID);

    expect(result).toEqual({ data: { team }, success: true });
  });

  it("returns team without a role field for authenticated users", async () => {
    const team = createTestTeamRecord();
    findSpace.mockResolvedValue({ accessPassword: null, id: "space-1", isPrivate: false });
    readTeamRecord.mockResolvedValue(team);
    getSession.mockResolvedValue(createMockSession());

    const result = await getPublicTeam(VALID_UUID);

    expect(result).toEqual({ data: { team }, success: true });
    if (result.success) {
      expect(result.data).not.toHaveProperty("role");
    }
  });

  it("skips the membership lookup for public teams", async () => {
    const team = createTestTeamRecord();
    findSpace.mockResolvedValue({ accessPassword: null, id: "space-1", isPrivate: false });
    readTeamRecord.mockResolvedValue(team);
    getSession.mockResolvedValue(createMockSession());

    await getPublicTeam(VALID_UUID);

    expect(getTeamRole).not.toHaveBeenCalled();
  });
});

describe("validateTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when space exists", async () => {
    findSpace.mockResolvedValue({ accessPassword: null, id: "space-1", isPrivate: false });

    const result = await validateTeam(VALID_UUID);

    expect(result).toBe(true);
  });

  it("returns false when space does not exist", async () => {
    findSpace.mockResolvedValue(null);

    const result = await validateTeam(VALID_UUID);

    expect(result).toBe(false);
  });
});

describe("getTeamName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the trimmed summary name", async () => {
    readTeamSummary.mockResolvedValue({ memberCount: 0, name: "  My Team  " });

    const result = await getTeamName(VALID_UUID);

    expect(result).toBe("My Team");
  });

  it("returns null for empty name", async () => {
    readTeamSummary.mockResolvedValue({ memberCount: 0, name: "   " });

    const result = await getTeamName(VALID_UUID);

    expect(result).toBeNull();
  });

  it("returns null when the team has no stored record", async () => {
    readTeamSummary.mockResolvedValue(null);

    const result = await getTeamName(VALID_UUID);

    expect(result).toBeNull();
  });
});

describe("getTeamMembershipRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTeamRole.mockResolvedValue(null);
  });

  it("returns role from membership", async () => {
    getTeamRole.mockResolvedValue({ role: "ADMIN", userId: "user-123" });

    const result = await getTeamMembershipRole(VALID_UUID);

    expect(result).toBe("ADMIN");
  });

  it("returns null when no membership exists", async () => {
    const result = await getTeamMembershipRole(VALID_UUID);

    expect(result).toBeNull();
  });

  it("looks up membership by team ID", async () => {
    getTeamRole.mockResolvedValue({ role: "ADMIN", userId: "user-123" });

    await getTeamMembershipRole(VALID_UUID);

    expect(getTeamRole).toHaveBeenCalledWith(VALID_UUID);
  });

  it("returns null for an anonymous caller without querying", async () => {
    const result = await getTeamMembershipRole(VALID_UUID);

    expect(result).toBeNull();
    expect(getTeamRole).toHaveBeenCalledWith(VALID_UUID);
  });
});
