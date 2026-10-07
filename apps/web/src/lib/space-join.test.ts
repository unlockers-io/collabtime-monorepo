import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestMember,
  createTestTeamRecord,
  createTestTeamStore,
  VALID_UUID,
  VALID_UUID_2,
} from "./actions/test-helpers";
import { createSpaceJoiner } from "./space-join";

type SpaceJoinDeps = Parameters<typeof createSpaceJoiner>[0];

const harness = createTestTeamStore();
const findPrivateSpaces = vi.fn<SpaceJoinDeps["findPrivateSpaces"]>();
const reportError = vi.fn<SpaceJoinDeps["reportError"]>();
const verifyAccessToken = vi.fn<SpaceJoinDeps["verifyAccessToken"]>();
const { joinPrivateSpace, joinPrivateSpacesFromCookies } = createSpaceJoiner({
  findPrivateSpaces,
  grantMembership: harness.grantMembership,
  reportError,
  verifyAccessToken,
});

const validFor = (...validTokens: Array<string>) => {
  verifyAccessToken.mockImplementation((token) => validTokens.includes(token));
};

const space = (id: string, teamId: string) => ({ accessPassword: "hash", id, teamId });

describe("joinPrivateSpacesFromCookies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.reset();
    findPrivateSpaces.mockResolvedValue([]);
  });

  it("does nothing for an empty cookie header", async () => {
    await joinPrivateSpacesFromCookies("user-1", null);
    await joinPrivateSpacesFromCookies("user-1", "");

    expect(findPrivateSpaces).not.toHaveBeenCalled();
    expect(harness.membershipStore.grant).not.toHaveBeenCalled();
  });

  it("ignores non space-access cookies", async () => {
    await joinPrivateSpacesFromCookies("user-1", "session=abc; theme=dark");

    expect(findPrivateSpaces).not.toHaveBeenCalled();
  });

  it("skips cookies whose token fails verification", async () => {
    validFor(); // nothing valid
    findPrivateSpaces.mockResolvedValue([space("space1", "team-1")]);

    await joinPrivateSpacesFromCookies("user-1", "space-access-space1=forged");

    expect(harness.membershipStore.grant).not.toHaveBeenCalled();
  });

  it("queries candidate spaceIds and only private spaces", async () => {
    validFor("good");

    await joinPrivateSpacesFromCookies(
      "user-1",
      "space-access-space1=good; space-access-space2=bad; junk=1",
    );

    expect(findPrivateSpaces).toHaveBeenCalledWith(["space1", "space2"]);
  });

  it("verifies each token against that space's own current password hash", async () => {
    validFor("good");
    findPrivateSpaces.mockResolvedValue([
      { accessPassword: "hash-1", id: "space1", teamId: "team-1" },
    ]);

    await joinPrivateSpacesFromCookies("user-1", "space-access-space1=good");

    expect(verifyAccessToken).toHaveBeenCalledWith("good", "space1", "hash-1");
  });

  it("caps the candidate list so a forged cookie flood cannot widen the query", async () => {
    validFor();
    const header = Array.from({ length: 100 }, (_, i) => `space-access-s${i}=x`).join("; ");

    await joinPrivateSpacesFromCookies("user-1", header);

    expect(findPrivateSpaces).toHaveBeenCalledTimes(1);
    expect(findPrivateSpaces.mock.calls[0]?.[0]).toHaveLength(20);
  });

  it("grants a MEMBER membership and re-activates archived ones", async () => {
    validFor("good", "other");
    findPrivateSpaces.mockResolvedValue([
      space("space1", VALID_UUID),
      space("space2", VALID_UUID_2),
    ]);
    harness.seedMembership("user-1", "MEMBER", new Date());

    await joinPrivateSpacesFromCookies(
      "user-1",
      "space-access-space1=good; space-access-space2=other",
    );

    expect(harness.findMembership("user-1")).toEqual({ archivedAt: null, role: "MEMBER" });
    expect(harness.findMembership("user-1", VALID_UUID_2)).toEqual({
      archivedAt: null,
      role: "MEMBER",
    });
  });

  it("does not throw when the grant rejects (best-effort)", async () => {
    validFor("good");
    findPrivateSpaces.mockResolvedValue([space("space1", VALID_UUID)]);
    harness.membershipStore.grant.mockRejectedValue(new Error("db down"));

    await expect(
      joinPrivateSpacesFromCookies("user-1", "space-access-space1=good"),
    ).resolves.toBeUndefined();
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Failed to materialize private-space membership" }),
    );
  });
});

describe("joinPrivateSpace", () => {
  beforeEach(() => {
    harness.reset();
  });

  it("grants access without adding the viewer to the roster", async () => {
    const team = createTestTeamRecord({ members: [createTestMember()] });
    await harness.seedTeam(team);

    await joinPrivateSpace("user-9", VALID_UUID);

    expect(harness.findMembership("user-9")).toEqual({ archivedAt: null, role: "MEMBER" });
    expect(await harness.readTeam()).toEqual(team);
  });

  it("never demotes an existing role", async () => {
    harness.seedMembership("user-9", "ADMIN");

    await joinPrivateSpace("user-9", VALID_UUID);

    expect(harness.findMembership("user-9")).toEqual({ archivedAt: null, role: "ADMIN" });
  });
});
