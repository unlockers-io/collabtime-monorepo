import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSession, createTestTeamRecord, VALID_UUID } from "./test-helpers";

vi.mock("@repo/db", () => ({
  prisma: {
    space: { findUnique: vi.fn() },
    membership: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/auth-server", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/team-auth", () => ({ getTeamRole: vi.fn(), requireTeamAdmin: vi.fn() }));
vi.mock("../redis", () => ({ redis: { get: vi.fn() } }));
vi.mock("./helpers", () => ({ getTeamRecord: vi.fn(), sanitizeTeam: vi.fn((t: unknown) => t) }));
vi.mock("next/headers", () => ({ headers: vi.fn(() => Promise.resolve(new Headers())) }));
vi.mock("@/types", () => ({
  isTeamRole: (v: unknown) => typeof v === "string" && ["ADMIN", "MEMBER"].includes(v),
}));

import { prisma } from "@repo/db";

import { auth } from "@/lib/auth-server";
import { getTeamRole } from "@/lib/team-auth";

import { redis } from "../redis";

import { getTeamRecord } from "./helpers";
import { getPublicTeam, getTeamMembershipRole, getTeamName, validateTeam } from "./team-read";

describe("getPublicTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when space not found", async () => {
    vi.mocked(prisma.space.findUnique).mockResolvedValue(null as never);

    const result = await getPublicTeam(VALID_UUID);

    expect(result).toEqual({ success: false, error: "Team not found" });
  });

  it("blocks private team access for non-members", async () => {
    vi.mocked(prisma.space.findUnique).mockResolvedValue({ isPrivate: true } as never);
    vi.mocked(getTeamRole).mockResolvedValue(null as never);

    const result = await getPublicTeam(VALID_UUID);

    expect(result).toEqual({ success: false, error: "This team is private" });
  });

  it("returns team with correct role for authenticated users", async () => {
    const team = createTestTeamRecord();
    vi.mocked(prisma.space.findUnique).mockResolvedValue({ isPrivate: false } as never);
    vi.mocked(getTeamRecord).mockResolvedValue(team as never);
    const session = createMockSession();
    vi.mocked(auth.api.getSession).mockResolvedValue(session as never);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ role: "ADMIN" } as never);

    const result = await getPublicTeam(VALID_UUID);

    expect(result).toEqual({
      success: true,
      data: { team, role: "ADMIN" },
    });
  });
});

describe("validateTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when space exists", async () => {
    vi.mocked(prisma.space.findUnique).mockResolvedValue({ id: 1 } as never);

    const result = await validateTeam(VALID_UUID);

    expect(result).toBe(true);
  });

  it("returns false when space does not exist", async () => {
    vi.mocked(prisma.space.findUnique).mockResolvedValue(null as never);

    const result = await validateTeam(VALID_UUID);

    expect(result).toBe(false);
  });
});

describe("getTeamName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns trimmed name from redis", async () => {
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify({ name: "  My Team  " }) as never);

    const result = await getTeamName(VALID_UUID);

    expect(result).toBe("My Team");
  });

  it("returns null for empty name", async () => {
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify({ name: "   " }) as never);

    const result = await getTeamName(VALID_UUID);

    expect(result).toBeNull();
  });

  it("returns null when no data in redis", async () => {
    vi.mocked(redis.get).mockResolvedValue(null as never);

    const result = await getTeamName(VALID_UUID);

    expect(result).toBeNull();
  });
});

describe("getTeamMembershipRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns role from membership", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ role: "ADMIN" } as never);

    const result = await getTeamMembershipRole(VALID_UUID, "user-123");

    expect(result).toBe("ADMIN");
  });

  it("returns null when no membership exists", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null as never);

    const result = await getTeamMembershipRole(VALID_UUID, "user-123");

    expect(result).toBeNull();
  });
});
