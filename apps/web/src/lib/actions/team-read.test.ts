import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSession, createTestTeamRecord, VALID_UUID } from "./test-helpers";

vi.mock("@repo/db", () => ({
  prisma: {
    membership: { findUnique: vi.fn() },
    space: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/auth-server", () => ({ getSession: vi.fn() }));
vi.mock("../team-store", () => ({ readTeamRecord: vi.fn() }));
vi.mock("./helpers", () => ({ sanitizeTeam: vi.fn((t: unknown) => t) }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: vi.fn(() => undefined) })),
  headers: vi.fn(() => Promise.resolve(new Headers())),
}));
vi.mock("@/types", () => ({
  isTeamRole: (v: unknown) => typeof v === "string" && ["ADMIN", "MEMBER"].includes(v),
}));

import { prisma } from "@repo/db";

import { getSession } from "@/lib/auth-server";

import { readTeamRecord } from "../team-store";

import { getPublicTeam, getTeamMembershipRole, getTeamName, validateTeam } from "./team-read";

describe("getPublicTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(null);
  });

  it("returns error when space not found", async () => {
    vi.mocked(prisma.space.findUnique).mockResolvedValue(null);

    const result = await getPublicTeam(VALID_UUID);

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("blocks private team access for guests without an access cookie", async () => {
    vi.mocked(prisma.space.findUnique).mockResolvedValue({
      id: "space-1",
      isPrivate: true,
    } as never);

    const result = await getPublicTeam(VALID_UUID);

    expect(result).toEqual({ error: "This team is private", success: false });
  });

  it("allows private team access for members via their membership", async () => {
    const team = createTestTeamRecord();
    vi.mocked(prisma.space.findUnique).mockResolvedValue({
      id: "space-1",
      isPrivate: true,
    } as never);
    vi.mocked(getSession).mockResolvedValue(createMockSession() as never);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ role: "MEMBER" } as never);
    vi.mocked(readTeamRecord).mockResolvedValue(team);

    const result = await getPublicTeam(VALID_UUID);

    expect(result).toEqual({ data: { team }, success: true });
  });

  it("returns team without a role field for authenticated users", async () => {
    const team = createTestTeamRecord();
    vi.mocked(prisma.space.findUnique).mockResolvedValue({ isPrivate: false } as never);
    vi.mocked(readTeamRecord).mockResolvedValue(team);
    vi.mocked(getSession).mockResolvedValue(createMockSession() as never);

    const result = await getPublicTeam(VALID_UUID);

    expect(result).toEqual({ data: { team }, success: true });
    if (result.success) {
      expect(result.data).not.toHaveProperty("role");
    }
  });

  it("skips the membership lookup for public teams", async () => {
    const team = createTestTeamRecord();
    vi.mocked(prisma.space.findUnique).mockResolvedValue({ isPrivate: false } as never);
    vi.mocked(readTeamRecord).mockResolvedValue(team);
    vi.mocked(getSession).mockResolvedValue(createMockSession() as never);

    await getPublicTeam(VALID_UUID);

    expect(prisma.membership.findUnique).not.toHaveBeenCalled();
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
    vi.mocked(prisma.space.findUnique).mockResolvedValue(null);

    const result = await validateTeam(VALID_UUID);

    expect(result).toBe(false);
  });
});

describe("getTeamName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the trimmed space name", async () => {
    vi.mocked(prisma.space.findUnique).mockResolvedValue({ name: "  My Team  " } as never);

    const result = await getTeamName(VALID_UUID);

    expect(result).toBe("My Team");
  });

  it("returns null for a blank name", async () => {
    vi.mocked(prisma.space.findUnique).mockResolvedValue({ name: "   " } as never);

    const result = await getTeamName(VALID_UUID);

    expect(result).toBeNull();
  });

  it("returns null when the space is gone", async () => {
    vi.mocked(prisma.space.findUnique).mockResolvedValue(null);

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
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

    const result = await getTeamMembershipRole(VALID_UUID, "user-123");

    expect(result).toBeNull();
  });
});
