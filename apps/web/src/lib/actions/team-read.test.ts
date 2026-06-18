import { db, membership, space, user } from "@repo/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSession, createTestTeamRecord } from "./test-helpers";

vi.mock("@/lib/auth-server", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/team-auth", () => ({ getTeamRole: vi.fn(), requireTeamAdmin: vi.fn() }));
vi.mock("../redis", () => ({ redis: { get: vi.fn() } }));
vi.mock("./helpers", () => ({ getTeamRecord: vi.fn(), sanitizeTeam: vi.fn((t: unknown) => t) }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: vi.fn(() => undefined) })),
  headers: vi.fn(() => Promise.resolve(new Headers())),
}));

import { auth } from "@/lib/auth-server";
import { getTeamRole } from "@/lib/team-auth";

import { redis } from "../redis";

import { getTeamRecord } from "./helpers";
import { getPublicTeam, getTeamMembershipRole, getTeamName, validateTeam } from "./team-read";

const USER_ID = "team-read-user-1";
const SPACE_ID = "team-read-space-1";
// File-unique team id (unique Space.teamId constraint forbids sharing with other test files).
const TEAM_ID = "bd658c9e-5b56-4400-81d6-34433c3e3bed";
// A team id that is never seeded — used for the "space does not exist" cases so the
// cache()-wrapped validateTeam can't return a memoized positive from a sibling test.
const MISSING_TEAM_ID = "22304890-77a4-414c-b458-b62a4cd50731";

const now = () => new Date().toISOString();

const seedSpace = async (isPrivate: boolean) => {
  await db.delete(space).where(eq(space.id, SPACE_ID));
  await db.insert(space).values({
    id: SPACE_ID,
    isPrivate,
    ownerId: USER_ID,
    teamId: TEAM_ID,
    updatedAt: now(),
  });
};

const removeSpace = async () => {
  await db.delete(membership).where(eq(membership.teamId, TEAM_ID));
  await db.delete(space).where(eq(space.id, SPACE_ID));
};

beforeAll(async () => {
  await db.delete(user).where(eq(user.id, USER_ID));
  await db.insert(user).values({
    email: "team-read-user-1@example.com",
    emailVerified: true,
    id: USER_ID,
    name: "Team Read User",
    updatedAt: now(),
  });
});

afterAll(async () => {
  await removeSpace();
  await db.delete(user).where(eq(user.id, USER_ID));
});

beforeEach(async () => {
  vi.clearAllMocks();
  await removeSpace();
});

describe("getPublicTeam", () => {
  it("returns error when space not found", async () => {
    const result = await getPublicTeam(MISSING_TEAM_ID);

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("blocks private team access for non-members", async () => {
    await seedSpace(true);
    vi.mocked(getTeamRole).mockResolvedValue(null as never);

    const result = await getPublicTeam(TEAM_ID);

    expect(result).toEqual({ error: "This team is private", success: false });
  });

  it("returns team with correct role for authenticated users", async () => {
    const team = createTestTeamRecord();
    await seedSpace(false);
    await db.insert(membership).values({
      id: "team-read-membership-1",
      role: "ADMIN",
      teamId: TEAM_ID,
      updatedAt: now(),
      userId: USER_ID,
    });
    vi.mocked(getTeamRecord).mockResolvedValue(team as never);
    const session = createMockSession({ userId: USER_ID });
    vi.mocked(auth.api.getSession).mockResolvedValue(session as never);

    const result = await getPublicTeam(TEAM_ID);

    expect(result).toEqual({
      data: { role: "ADMIN", team },
      success: true,
    });
  });
});

describe("validateTeam", () => {
  it("returns true when space exists", async () => {
    await seedSpace(false);

    const result = await validateTeam(TEAM_ID);

    expect(result).toBe(true);
  });

  it("returns false when space does not exist", async () => {
    const result = await validateTeam(MISSING_TEAM_ID);

    expect(result).toBe(false);
  });
});

describe("getTeamName", () => {
  it("returns trimmed name from redis", async () => {
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify({ name: "  My Team  " }) as never);

    const result = await getTeamName(TEAM_ID);

    expect(result).toBe("My Team");
  });

  it("returns null for empty name", async () => {
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify({ name: "   " }) as never);

    const result = await getTeamName(TEAM_ID);

    expect(result).toBeNull();
  });

  it("returns null when no data in redis", async () => {
    vi.mocked(redis.get).mockResolvedValue(null as never);

    const result = await getTeamName(TEAM_ID);

    expect(result).toBeNull();
  });
});

describe("getTeamMembershipRole", () => {
  it("returns role from membership", async () => {
    await seedSpace(false);
    await db.insert(membership).values({
      id: "team-read-membership-2",
      role: "ADMIN",
      teamId: TEAM_ID,
      updatedAt: now(),
      userId: USER_ID,
    });

    const result = await getTeamMembershipRole(TEAM_ID, USER_ID);

    expect(result).toBe("ADMIN");
  });

  it("returns null when no membership exists", async () => {
    const result = await getTeamMembershipRole(MISSING_TEAM_ID, USER_ID);

    expect(result).toBeNull();
  });
});
