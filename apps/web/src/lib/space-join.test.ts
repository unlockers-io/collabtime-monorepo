import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability", () => ({
  log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/space-access", () => ({
  SPACE_ACCESS_COOKIE_PREFIX: "space-access-",
  verifySpaceAccessToken: vi.fn(),
}));
vi.mock("@repo/db", () => ({
  prisma: {
    membership: { upsert: vi.fn() },
    space: { findMany: vi.fn() },
  },
}));

import { prisma } from "@repo/db";

import { verifySpaceAccessToken } from "@/lib/space-access";

import { joinPrivateSpace, joinPrivateSpacesFromCookies } from "./space-join";

const validFor = (...validTokens: Array<string>) => {
  vi.mocked(verifySpaceAccessToken).mockImplementation((token: string) =>
    validTokens.includes(token)
      ? { payload: {} as never, valid: true }
      : { reason: "x", valid: false },
  );
};

const space = (id: string, teamId: string) => ({ accessPassword: "hash", id, teamId });

describe("joinPrivateSpacesFromCookies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.space.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.membership.upsert).mockResolvedValue({} as never);
  });

  it("does nothing for an empty cookie header", async () => {
    await joinPrivateSpacesFromCookies("user-1", null);
    await joinPrivateSpacesFromCookies("user-1", "");

    expect(prisma.space.findMany).not.toHaveBeenCalled();
    expect(prisma.membership.upsert).not.toHaveBeenCalled();
  });

  it("ignores non space-access cookies", async () => {
    await joinPrivateSpacesFromCookies("user-1", "session=abc; theme=dark");

    expect(prisma.space.findMany).not.toHaveBeenCalled();
  });

  it("skips cookies whose token fails verification", async () => {
    validFor(); // nothing valid
    vi.mocked(prisma.space.findMany).mockResolvedValue([space("space1", "team-1")] as never);

    await joinPrivateSpacesFromCookies("user-1", "space-access-space1=forged");

    expect(prisma.membership.upsert).not.toHaveBeenCalled();
  });

  it("queries candidate spaceIds and only private spaces", async () => {
    validFor("good");

    await joinPrivateSpacesFromCookies(
      "user-1",
      "space-access-space1=good; space-access-space2=bad; junk=1",
    );

    expect(prisma.space.findMany).toHaveBeenCalledWith({
      select: { accessPassword: true, id: true, teamId: true },
      where: { id: { in: ["space1", "space2"] }, isPrivate: true },
    });
  });

  it("verifies each token against that space's own current password hash", async () => {
    validFor("good");
    vi.mocked(prisma.space.findMany).mockResolvedValue([
      { accessPassword: "hash-1", id: "space1", teamId: "team-1" },
    ] as never);

    await joinPrivateSpacesFromCookies("user-1", "space-access-space1=good");

    expect(verifySpaceAccessToken).toHaveBeenCalledWith("good", "space1", "hash-1");
  });

  it("caps the candidate list so a forged cookie flood cannot widen the query", async () => {
    validFor();
    const header = Array.from({ length: 100 }, (_, i) => `space-access-s${i}=x`).join("; ");

    await joinPrivateSpacesFromCookies("user-1", header);

    expect(prisma.space.findMany).toHaveBeenCalledTimes(1);
    const call = vi.mocked(prisma.space.findMany).mock.calls[0]?.[0] as {
      where: { id: { in: Array<string> } };
    };
    expect(call.where.id.in).toHaveLength(20);
  });

  it("upserts a MEMBER membership and re-activates archived ones", async () => {
    validFor("good");
    vi.mocked(prisma.space.findMany).mockResolvedValue([space("space1", "team-1")] as never);

    await joinPrivateSpacesFromCookies("user-1", "space-access-space1=good");

    expect(prisma.membership.upsert).toHaveBeenCalledWith({
      create: { role: "MEMBER", teamId: "team-1", userId: "user-1" },
      update: { archivedAt: null },
      where: { userId_teamId: { teamId: "team-1", userId: "user-1" } },
    });
  });

  it("does not throw when the upsert rejects (best-effort)", async () => {
    validFor("good");
    vi.mocked(prisma.space.findMany).mockResolvedValue([space("space1", "team-1")] as never);
    vi.mocked(prisma.membership.upsert).mockRejectedValue(new Error("db down"));

    await expect(
      joinPrivateSpacesFromCookies("user-1", "space-access-space1=good"),
    ).resolves.toBeUndefined();
  });
});

describe("joinPrivateSpace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts MEMBER, never demoting an existing role", async () => {
    vi.mocked(prisma.membership.upsert).mockResolvedValue({} as never);

    await joinPrivateSpace("user-9", "team-9");

    expect(prisma.membership.upsert).toHaveBeenCalledWith({
      create: { role: "MEMBER", teamId: "team-9", userId: "user-9" },
      update: { archivedAt: null },
      where: { userId_teamId: { teamId: "team-9", userId: "user-9" } },
    });
  });
});
