import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSession } from "./test-helpers";

vi.mock("@/lib/team-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@repo/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    space: { create: vi.fn() },
    membership: { create: vi.fn() },
  },
}));
vi.mock("../redis", () => ({ redis: { set: vi.fn() }, TEAM_INITIAL_TTL_SECONDS: 100 }));
vi.mock("uuid", () => ({ v4: vi.fn(() => "test-team-id") }));

import { prisma } from "@repo/db";

import { requireAuth } from "@/lib/team-auth";

import { redis } from "../redis";

import { createTeam } from "./team-create";

describe("createTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error("Unauthorized"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createTeam();

    expect(result).toEqual({ success: false, error: "Failed to create team" });
    spy.mockRestore();
  });

  it("creates space and membership in a transaction", async () => {
    const session = createMockSession();
    vi.mocked(requireAuth).mockResolvedValue(session as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined as never);
    vi.mocked(redis.set).mockResolvedValue("OK" as never);

    await createTeam();

    expect(prisma.$transaction).toHaveBeenCalledWith([
      prisma.space.create({
        data: { teamId: "test-team-id", isPrivate: false, ownerId: "user-123" },
      }),
      prisma.membership.create({
        data: { userId: "user-123", teamId: "test-team-id", role: "ADMIN" },
      }),
    ]);
  });

  it("populates redis cache after commit", async () => {
    const session = createMockSession();
    vi.mocked(requireAuth).mockResolvedValue(session as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined as never);
    vi.mocked(redis.set).mockResolvedValue("OK" as never);

    await createTeam();

    expect(redis.set).toHaveBeenCalledWith(
      "team:test-team-id",
      expect.stringContaining('"id":"test-team-id"'),
      { ex: 100 },
    );
  });

  it("succeeds even if redis cache fails", async () => {
    const session = createMockSession();
    vi.mocked(requireAuth).mockResolvedValue(session as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined as never);
    vi.mocked(redis.set).mockRejectedValue(new Error("Redis down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createTeam();

    expect(result).toEqual({ success: true, data: "test-team-id" });
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

    const result = await createTeam();

    expect(result).toEqual({ success: true, data: "test-team-id" });
  });
});
