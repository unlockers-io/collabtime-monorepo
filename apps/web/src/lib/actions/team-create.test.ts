import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSession } from "./test-helpers";

vi.mock("@/lib/observability", () => ({
  log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/team-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@repo/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    membership: { create: vi.fn() },
    space: { create: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("../redis", () => ({
  isRedisConfigured: (): boolean => true,
  readTeamJson: (): Promise<string | null> => Promise.resolve(null),
  redis: { set: vi.fn() },
  TEAM_ACTIVE_TTL_SECONDS: 100,
  TEAM_INITIAL_TTL_SECONDS: 100,
  teamKey: (teamId: string): string => `team:${teamId}`,
}));
vi.mock("../team-postgres-repository", () => ({ writeTeamMirror: vi.fn() }));

let uuidCounter = 0;
vi.mock("uuid", () => ({ v4: vi.fn(() => `test-uuid-${uuidCounter++}`) }));

import { prisma } from "@repo/db";

import { log } from "@/lib/observability";
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

    const result = await createTeam(TEST_TIMEZONE);

    expect(result).toEqual({ error: "Failed to create team", success: false });
  });

  it("creates space and membership in a transaction", async () => {
    const session = createMockSession();
    vi.mocked(requireAuth).mockResolvedValue(session as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(redis.set).mockResolvedValue("OK");

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
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(redis.set).mockResolvedValue("OK");

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

  it("does not report success when the team-contents write fails", async () => {
    const session = createMockSession();
    vi.mocked(requireAuth).mockResolvedValue(session as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(redis.set).mockRejectedValue(new Error("Redis down"));

    const result = await createTeam(TEST_TIMEZONE);

    expect(result).toEqual({ error: "Failed to create team", success: false });
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Space and membership committed but the team contents were not stored",
        reason: "write-failed",
        route: "actions/team-create",
      }),
    );
  });

  it("rolls back the Space row when the team-contents write fails", async () => {
    const session = createMockSession();
    vi.mocked(requireAuth).mockResolvedValue(session as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(redis.set).mockRejectedValue(new Error("Redis down"));

    await createTeam(TEST_TIMEZONE);

    expect(prisma.space.delete).toHaveBeenCalledWith({ where: { teamId: "test-uuid-0" } });
  });

  it("reports the original failure when the rollback also fails", async () => {
    const session = createMockSession();
    vi.mocked(requireAuth).mockResolvedValue(session as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(redis.set).mockRejectedValue(new Error("Redis down"));
    vi.mocked(prisma.space.delete).mockRejectedValue(new Error("Postgres down"));

    const result = await createTeam(TEST_TIMEZONE);

    expect(result).toEqual({ error: "Failed to create team", success: false });
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to roll back the Space row for a team with no contents",
        route: "actions/team-create",
      }),
    );
  });

  it("keeps the Space row when the team is created", async () => {
    const session = createMockSession();
    vi.mocked(requireAuth).mockResolvedValue(session as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(redis.set).mockResolvedValue("OK");

    await createTeam(TEST_TIMEZONE);

    expect(prisma.space.delete).not.toHaveBeenCalled();
  });

  it("returns the generated teamId on success", async () => {
    const session = createMockSession();
    vi.mocked(requireAuth).mockResolvedValue(session as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(redis.set).mockResolvedValue("OK");

    const result = await createTeam(TEST_TIMEZONE);

    expect(result).toEqual({ data: "test-uuid-0", success: true });
  });
});
