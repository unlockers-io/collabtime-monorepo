import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSpaceJoiner } from "./space-join";

type SpaceJoinDeps = Parameters<typeof createSpaceJoiner>[0];

const findPrivateSpaces = vi.fn<SpaceJoinDeps["findPrivateSpaces"]>();
const reportError = vi.fn<SpaceJoinDeps["reportError"]>();
const upsertMembership = vi.fn<SpaceJoinDeps["upsertMembership"]>();
const verifyAccessToken = vi.fn<SpaceJoinDeps["verifyAccessToken"]>();
const { joinPrivateSpace, joinPrivateSpacesFromCookies } = createSpaceJoiner({
  findPrivateSpaces,
  reportError,
  upsertMembership,
  verifyAccessToken,
});

const validFor = (...validTokens: Array<string>) => {
  verifyAccessToken.mockImplementation((token) => validTokens.includes(token));
};

const space = (id: string, teamId: string) => ({ accessPassword: "hash", id, teamId });

describe("joinPrivateSpacesFromCookies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findPrivateSpaces.mockResolvedValue([]);
    upsertMembership.mockResolvedValue();
  });

  it("does nothing for an empty cookie header", async () => {
    await joinPrivateSpacesFromCookies("user-1", null);
    await joinPrivateSpacesFromCookies("user-1", "");

    expect(findPrivateSpaces).not.toHaveBeenCalled();
    expect(upsertMembership).not.toHaveBeenCalled();
  });

  it("ignores non space-access cookies", async () => {
    await joinPrivateSpacesFromCookies("user-1", "session=abc; theme=dark");

    expect(findPrivateSpaces).not.toHaveBeenCalled();
  });

  it("skips cookies whose token fails verification", async () => {
    validFor(); // nothing valid
    findPrivateSpaces.mockResolvedValue([space("space1", "team-1")]);

    await joinPrivateSpacesFromCookies("user-1", "space-access-space1=forged");

    expect(upsertMembership).not.toHaveBeenCalled();
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

  it("upserts a MEMBER membership and re-activates archived ones", async () => {
    validFor("good");
    findPrivateSpaces.mockResolvedValue([space("space1", "team-1")]);

    await joinPrivateSpacesFromCookies("user-1", "space-access-space1=good");

    expect(upsertMembership).toHaveBeenCalledWith({
      create: { role: "MEMBER", teamId: "team-1", userId: "user-1" },
      update: { archivedAt: null },
      where: { userId_teamId: { teamId: "team-1", userId: "user-1" } },
    });
  });

  it("does not throw when the upsert rejects (best-effort)", async () => {
    validFor("good");
    findPrivateSpaces.mockResolvedValue([space("space1", "team-1")]);
    upsertMembership.mockRejectedValue(new Error("db down"));

    await expect(
      joinPrivateSpacesFromCookies("user-1", "space-access-space1=good"),
    ).resolves.toBeUndefined();
  });
});

describe("joinPrivateSpace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertMembership.mockResolvedValue();
  });

  it("upserts MEMBER, never demoting an existing role", async () => {
    await joinPrivateSpace("user-9", "team-9");

    expect(upsertMembership).toHaveBeenCalledWith({
      create: { role: "MEMBER", teamId: "team-9", userId: "user-9" },
      update: { archivedAt: null },
      where: { userId_teamId: { teamId: "team-9", userId: "user-9" } },
    });
  });
});
