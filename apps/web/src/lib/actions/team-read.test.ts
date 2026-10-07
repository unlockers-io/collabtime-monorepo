import { afterEach, describe, expect, it, vi } from "vitest";

import { issueAccessCookie } from "../workspace-access";
import { createTestAccessStore } from "../workspace-access-test-store";

import { createTeamReadActions } from "./team-read-core";
import { createMockSession, createTestTeamRecord, VALID_UUID } from "./test-helpers";

type TeamReadDeps = Parameters<typeof createTeamReadActions>[0];

const space = { accessPassword: "hash", id: "space-1", isPrivate: true, teamId: VALID_UUID };
const team = createTestTeamRecord();

const setup = () => {
  const access = createTestAccessStore();
  const findSpace = vi.fn<TeamReadDeps["findSpace"]>().mockResolvedValue(space);
  const getSession = vi.fn<TeamReadDeps["getSession"]>().mockResolvedValue(null);
  const { getPublicTeam } = createTeamReadActions({
    accessStore: access.store,
    findSpace,
    getSession,
    readTeamRecord: vi.fn<TeamReadDeps["readTeamRecord"]>().mockResolvedValue(team),
    reportError: vi.fn<TeamReadDeps["reportError"]>(),
  });
  return { access, findSpace, getPublicTeam, getSession };
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getPublicTeam", () => {
  it("returns error when space not found", async () => {
    const state = setup();
    state.findSpace.mockResolvedValue(null);

    expect(await state.getPublicTeam(VALID_UUID)).toEqual({
      error: "Team not found",
      success: false,
    });
  });

  it("blocks private team access for guests without an access cookie", async () => {
    const state = setup();
    expect(await state.getPublicTeam(VALID_UUID)).toEqual({
      error: "This team is private",
      success: false,
    });
  });

  it("allows a guest holding the private team's access cookie", async () => {
    vi.stubEnv("SPACE_ACCESS_SECRET", "test-space-secret-at-least-32-characters");
    const state = setup();
    state.access.setToken(space.id, issueAccessCookie(space.id, "hash").value);

    expect(await state.getPublicTeam(VALID_UUID)).toEqual({ data: { team }, success: true });
  });

  it("blocks signed-in non-members of a private team", async () => {
    const state = setup();
    state.getSession.mockResolvedValue(createMockSession());

    expect(await state.getPublicTeam(VALID_UUID)).toEqual({
      error: "This team is private",
      success: false,
    });
  });

  it("allows private team access for members via their membership", async () => {
    const state = setup();
    state.getSession.mockResolvedValue(createMockSession());
    state.access.addMembership(VALID_UUID, "user-123");

    expect(await state.getPublicTeam(VALID_UUID)).toEqual({ data: { team }, success: true });
    expect(state.access.store.findMembership).toHaveBeenCalledOnce();
  });

  it("returns a public team without a role field and without a membership lookup", async () => {
    const state = setup();
    state.findSpace.mockResolvedValue({ ...space, isPrivate: false });
    state.getSession.mockResolvedValue(createMockSession());

    const result = await state.getPublicTeam(VALID_UUID);

    expect(result).toEqual({ data: { team }, success: true });
    expect(result.success && result.data).not.toHaveProperty("role");
    expect(state.access.store.findMembership).not.toHaveBeenCalled();
  });
});
