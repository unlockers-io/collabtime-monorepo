import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSession } from "./test-helpers";

vi.mock("@/lib/team-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@repo/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    membership: { create: vi.fn() },
    space: { create: vi.fn() },
  },
}));
vi.mock("../redis", () => ({ redis: { set: vi.fn() }, TEAM_INITIAL_TTL_SECONDS: 100 }));

let uuidCounter = 0;
vi.mock("uuid", () => ({ v4: vi.fn(() => `test-uuid-${uuidCounter++}`) }));

import { prisma } from "@repo/db";

import { requireAuth } from "@/lib/team-auth";

import { redis } from "../redis";

import { createTeam } from "./team-create";

const TEST_TIMEZONE = "America/New_York";

describe("createTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  it("returns error when not authenticated", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error("Unauthorized"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createTeam(TEST_TIMEZONE);

    expect(result).toEqual({ error: "Failed to create team", success: false });
    spy.mockRestore();
  });

  it("creates space and membership in a transaction", async () => {
    const session = createMockSession();
    vi.mocked(requireAuth).mockResolvedValue(session as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined as never);
    vi.mocked(redis.set).mockResolvedValue("OK" as never);

    await createTeam(TEST_TIMEZONE);

    expect(prisma.$transaction).toHaveBeenCalledWith([
      prisma.space.create({
        data: { isPrivate: false, ownerId: "user-123", teamId: "test-uuid-0" },
      }),
      prisma.membership.create({
        data: { role: "ADMIN", teamId: "test-uuid-0", userId: "user-123" },
      }),
    ]);
  });

  it("populates redis cache with creator as first member", async () => {
    const session = createMockSession();
    vi.mocked(requireAuth).mockResolvedValue(session as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined as never);
    vi.mocked(redis.set).mockResolvedValue("OK" as never);

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
      userId: "user-123",
      workingHoursEnd: 17,
      workingHoursStart: 9,
    });
  });

  it("succeeds even if redis cache fails", async () => {
    const session = createMockSession();
    vi.mocked(requireAuth).mockResolvedValue(session as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined as never);
    vi.mocked(redis.set).mockRejectedValue(new Error("Redis down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createTeam(TEST_TIMEZONE);

    expect(result).toEqual({ data: "test-uuid-0", success: true });
    expect(spy).toHaveBeenCalledWith(
      "Post-commit Redis cache failed (team created in Postgres):",
      expect.any(Error),
    );
    spy.mockRestore();
  });

  it("returns the generated teamId on success", async () => {
    const session = createMockSession();
    vi.mocked(requireAuth).mockResolvedValue(session as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined as never);
    vi.mocked(redis.set).mockResolvedValue("OK" as never);

    const result = await createTeam(TEST_TIMEZONE);

    expect(result).toEqual({ data: "test-uuid-0", success: true });
  });
});
