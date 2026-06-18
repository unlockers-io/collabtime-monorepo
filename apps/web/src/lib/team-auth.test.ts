import { db, membership, space, user } from "@repo/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-server", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
}));

import { auth } from "@/lib/auth-server";

import { getTeamRole, requireAuth, requireTeamAdmin } from "./team-auth";

const mockedGetSession = vi.mocked(auth.api.getSession);

const USER_ID = "team-auth-user-1";
const TEAM_ID = "team-auth-team-1";
const SPACE_ID = "team-auth-space-1";

const now = () => new Date().toISOString();

const cleanup = async () => {
  await db.delete(membership).where(eq(membership.userId, USER_ID));
  await db.delete(space).where(eq(space.id, SPACE_ID));
  await db.delete(user).where(eq(user.id, USER_ID));
};

// Seed a user + space so the Membership FKs (userId → User, teamId → Space.teamId) resolve.
beforeAll(async () => {
  await cleanup();
  await db.insert(user).values({
    email: "team-auth-user-1@example.com",
    emailVerified: true,
    id: USER_ID,
    name: "Team Auth User",
    updatedAt: now(),
  });
  await db.insert(space).values({
    id: SPACE_ID,
    ownerId: USER_ID,
    teamId: TEAM_ID,
    updatedAt: now(),
  });
});

afterAll(async () => {
  await cleanup();
});

// Each test controls the membership row it needs; start every test with none.
beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete(membership).where(eq(membership.userId, USER_ID));
});

const seedMembership = async (role: "ADMIN" | "MEMBER") => {
  await db.insert(membership).values({
    id: `team-auth-membership-${role}`,
    role,
    teamId: TEAM_ID,
    updatedAt: now(),
    userId: USER_ID,
  });
};

describe("getTeamRole", () => {
  it("returns null when no session exists", async () => {
    mockedGetSession.mockResolvedValue(null);

    const result = await getTeamRole(TEAM_ID);
    expect(result).toBeNull();
  });

  it("returns null when no membership found", async () => {
    mockedGetSession.mockResolvedValue({ user: { id: USER_ID } } as never);

    const result = await getTeamRole(TEAM_ID);
    expect(result).toBeNull();
  });

  it("returns null when role is not a valid TeamRole", async () => {
    // The Postgres enum forbids storing an invalid role, so the only way to reach
    // the defensive isTeamRole guard is to force the query to yield a bad row.
    mockedGetSession.mockResolvedValue({ user: { id: USER_ID } } as never);
    const spy = vi
      .spyOn(db.query.membership, "findFirst")
      .mockResolvedValueOnce({ role: "INVALID_ROLE" } as never);

    const result = await getTeamRole(TEAM_ID);
    expect(result).toBeNull();
    spy.mockRestore();
  });

  it("returns userId and role for valid ADMIN member", async () => {
    mockedGetSession.mockResolvedValue({ user: { id: USER_ID } } as never);
    await seedMembership("ADMIN");

    const result = await getTeamRole(TEAM_ID);
    expect(result).toEqual({ role: "ADMIN", userId: USER_ID });
  });

  it("returns userId and role for valid MEMBER", async () => {
    mockedGetSession.mockResolvedValue({ user: { id: USER_ID } } as never);
    await seedMembership("MEMBER");

    const result = await getTeamRole(TEAM_ID);
    expect(result).toEqual({ role: "MEMBER", userId: USER_ID });
  });
});

describe("requireTeamAdmin", () => {
  it("throws when user is not a member", async () => {
    mockedGetSession.mockResolvedValue(null);

    await expect(requireTeamAdmin(TEAM_ID)).rejects.toThrow("Not a member of this team");
  });

  it("throws when user is MEMBER not ADMIN", async () => {
    mockedGetSession.mockResolvedValue({ user: { id: USER_ID } } as never);
    await seedMembership("MEMBER");

    await expect(requireTeamAdmin(TEAM_ID)).rejects.toThrow("Admin access required");
  });

  it("returns userId when user is ADMIN", async () => {
    mockedGetSession.mockResolvedValue({ user: { id: USER_ID } } as never);
    await seedMembership("ADMIN");

    const result = await requireTeamAdmin(TEAM_ID);
    expect(result).toBe(USER_ID);
  });
});

describe("requireAuth", () => {
  it("throws when no session exists", async () => {
    mockedGetSession.mockResolvedValue(null);

    await expect(requireAuth()).rejects.toThrow("Authentication required");
  });

  it("returns session when authenticated", async () => {
    const session = { user: { email: "test@test.com", id: USER_ID } };
    mockedGetSession.mockResolvedValue(session as never);

    const result = await requireAuth();
    expect(result).toEqual(session);
  });
});
