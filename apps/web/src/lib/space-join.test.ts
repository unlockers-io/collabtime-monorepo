import { db, membership, space, user } from "@repo/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability", () => ({
  log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/space-access", () => ({
  SPACE_ACCESS_COOKIE_PREFIX: "space-access-",
  verifySpaceAccessToken: vi.fn(),
}));

import { verifySpaceAccessToken } from "@/lib/space-access";

import { joinPrivateSpace, joinPrivateSpacesFromCookies } from "./space-join";

const USER_ID = "space-join-user-1";
const PRIVATE_SPACE_ID = "space-join-private";
const PRIVATE_TEAM_ID = "space-join-private-team";
const PUBLIC_SPACE_ID = "space-join-public";
const PUBLIC_TEAM_ID = "space-join-public-team";

const now = () => new Date().toISOString();

const validFor = (...validTokens: Array<string>) => {
  vi.mocked(verifySpaceAccessToken).mockImplementation((token: string) =>
    validTokens.includes(token)
      ? { payload: {} as never, valid: true }
      : { reason: "x", valid: false },
  );
};

const membershipFor = (teamId: string) =>
  db.query.membership.findFirst({
    where: and(eq(membership.userId, USER_ID), eq(membership.teamId, teamId)),
  });

const cleanup = async () => {
  await db.delete(membership).where(eq(membership.userId, USER_ID));
  await db.delete(space).where(eq(space.id, PRIVATE_SPACE_ID));
  await db.delete(space).where(eq(space.id, PUBLIC_SPACE_ID));
  await db.delete(user).where(eq(user.id, USER_ID));
};

beforeAll(async () => {
  await cleanup();
  await db.insert(user).values({
    email: "space-join-user-1@example.com",
    emailVerified: true,
    id: USER_ID,
    name: "Space Join User",
    updatedAt: now(),
  });
  await db.insert(space).values({
    id: PRIVATE_SPACE_ID,
    isPrivate: true,
    ownerId: USER_ID,
    teamId: PRIVATE_TEAM_ID,
    updatedAt: now(),
  });
  await db.insert(space).values({
    id: PUBLIC_SPACE_ID,
    isPrivate: false,
    ownerId: USER_ID,
    teamId: PUBLIC_TEAM_ID,
    updatedAt: now(),
  });
});

afterAll(async () => {
  await cleanup();
});

beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete(membership).where(eq(membership.userId, USER_ID));
});

describe("joinPrivateSpacesFromCookies", () => {
  it("does nothing for an empty cookie header", async () => {
    await joinPrivateSpacesFromCookies(USER_ID, null);
    await joinPrivateSpacesFromCookies(USER_ID, "");

    expect(await membershipFor(PRIVATE_TEAM_ID)).toBeUndefined();
  });

  it("ignores non space-access cookies", async () => {
    await joinPrivateSpacesFromCookies(USER_ID, "session=abc; theme=dark");

    expect(await membershipFor(PRIVATE_TEAM_ID)).toBeUndefined();
  });

  it("skips cookies whose token fails verification", async () => {
    validFor(); // nothing valid

    await joinPrivateSpacesFromCookies(USER_ID, `space-access-${PRIVATE_SPACE_ID}=forged`);

    expect(await membershipFor(PRIVATE_TEAM_ID)).toBeUndefined();
  });

  it("joins only valid spaceIds and only private spaces", async () => {
    validFor("good");

    await joinPrivateSpacesFromCookies(
      USER_ID,
      `space-access-${PRIVATE_SPACE_ID}=good; space-access-${PUBLIC_SPACE_ID}=good; junk=1`,
    );

    // Private space membership created; public space ignored (isPrivate filter).
    expect(await membershipFor(PRIVATE_TEAM_ID)).toBeDefined();
    expect(await membershipFor(PUBLIC_TEAM_ID)).toBeUndefined();
  });

  it("re-activates an archived membership", async () => {
    validFor("good");
    await db.insert(membership).values({
      archivedAt: now(),
      id: "space-join-archived",
      role: "MEMBER",
      teamId: PRIVATE_TEAM_ID,
      updatedAt: now(),
      userId: USER_ID,
    });

    await joinPrivateSpacesFromCookies(USER_ID, `space-access-${PRIVATE_SPACE_ID}=good`);

    const row = await membershipFor(PRIVATE_TEAM_ID);
    expect(row?.archivedAt).toBeNull();
  });

  it("does not throw when there is nothing to join (best-effort)", async () => {
    validFor(); // nothing valid

    await expect(
      joinPrivateSpacesFromCookies(USER_ID, `space-access-${PRIVATE_SPACE_ID}=forged`),
    ).resolves.toBeUndefined();
  });
});

describe("joinPrivateSpace", () => {
  it("creates a MEMBER membership", async () => {
    await joinPrivateSpace(USER_ID, PRIVATE_TEAM_ID);

    const row = await membershipFor(PRIVATE_TEAM_ID);
    expect(row?.role).toBe("MEMBER");
  });

  it("never demotes an existing ADMIN role on conflict", async () => {
    await db.insert(membership).values({
      id: "space-join-admin",
      role: "ADMIN",
      teamId: PRIVATE_TEAM_ID,
      updatedAt: now(),
      userId: USER_ID,
    });

    await joinPrivateSpace(USER_ID, PRIVATE_TEAM_ID);

    const row = await membershipFor(PRIVATE_TEAM_ID);
    expect(row?.role).toBe("ADMIN");
  });
});
