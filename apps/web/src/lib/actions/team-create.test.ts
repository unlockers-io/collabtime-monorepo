import { db, membership, space, user } from "@repo/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSession } from "./test-helpers";

vi.mock("@/lib/observability", () => ({
  log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/team-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("../redis", () => ({ redis: { set: vi.fn() }, TEAM_INITIAL_TTL_SECONDS: 100 }));

// Deterministic uuids so the created teamId is predictable across the transaction.
let uuidCounter = 0;
vi.mock("uuid", () => ({ v4: vi.fn(() => `team-create-${uuidCounter++}`) }));

import { log } from "@/lib/observability";
import { requireAuth } from "@/lib/team-auth";

import { redis } from "../redis";

import { createTeam } from "./team-create";

const TEST_TIMEZONE = "America/New_York";
const USER_ID = "team-create-user-1";

const session = createMockSession({ name: "Test User", userId: USER_ID });

const cleanupTeam = async (teamId: string) => {
  await db.delete(membership).where(eq(membership.teamId, teamId));
  await db.delete(space).where(eq(space.teamId, teamId));
};

beforeAll(async () => {
  await db.delete(user).where(eq(user.id, USER_ID));
  await db.insert(user).values({
    email: "team-create-user-1@example.com",
    emailVerified: true,
    id: USER_ID,
    name: "Test User",
    updatedAt: new Date().toISOString(),
  });
});

afterAll(async () => {
  await db.delete(user).where(eq(user.id, USER_ID));
});

beforeEach(() => {
  vi.clearAllMocks();
  uuidCounter = 0;
  vi.mocked(requireAuth).mockResolvedValue(session as never);
  vi.mocked(redis.set).mockResolvedValue("OK" as never);
});

// The first uuid is the teamId; clean both tables for it after every test.
afterEach(async () => {
  await cleanupTeam("team-create-0");
});

describe("createTeam", () => {
  it("returns error when not authenticated", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error("Unauthorized"));

    const result = await createTeam(TEST_TIMEZONE);

    expect(result).toEqual({ error: "Failed to create team", success: false });
  });

  it("creates a Space and an ADMIN Membership in Postgres", async () => {
    const result = await createTeam(TEST_TIMEZONE);

    expect(result.success).toBe(true);
    const teamId = result.success ? result.data : "";

    const createdSpace = await db.query.space.findFirst({
      where: eq(space.teamId, teamId),
    });
    expect(createdSpace?.ownerId).toBe(USER_ID);
    expect(createdSpace?.isPrivate).toBe(false);

    const createdMembership = await db.query.membership.findFirst({
      where: eq(membership.teamId, teamId),
    });
    expect(createdMembership?.role).toBe("ADMIN");
    expect(createdMembership?.userId).toBe(USER_ID);
  });

  it("populates redis cache with creator as first member", async () => {
    await createTeam(TEST_TIMEZONE);

    const redisCall = vi.mocked(redis.set).mock.calls[0];
    const storedTeam = JSON.parse(redisCall[1] as string) as {
      members: Array<Record<string, unknown>>;
    };

    expect(storedTeam.members).toHaveLength(1);
    expect(storedTeam.members[0]).toMatchObject({
      name: "Test User",
      order: 0,
      timezone: TEST_TIMEZONE,
      userId: USER_ID,
      workingHoursEnd: 17,
      workingHoursStart: 9,
    });
  });

  it("succeeds even if redis cache fails", async () => {
    vi.mocked(redis.set).mockRejectedValue(new Error("Redis down"));

    const result = await createTeam(TEST_TIMEZONE);

    expect(result).toEqual({ data: "team-create-0", success: true });
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Post-commit Redis cache failed (team created in Postgres)",
        route: "actions/team-create",
      }),
    );
  });

  it("returns the generated teamId on success", async () => {
    const result = await createTeam(TEST_TIMEZONE);

    expect(result).toEqual({ data: "team-create-0", success: true });
  });
});
