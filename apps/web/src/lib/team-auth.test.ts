import { readFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-server", () => ({
  getSession: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    membership: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@repo/db";

import { getSession } from "@/lib/auth-server";

import { getTeamRole, requireAuth, requireTeamAdmin } from "./team-auth";

const mockedGetSession = vi.mocked(getSession);
const mockedFindMembership = vi.mocked(prisma.membership.findUnique);

describe("module surface", () => {
  // "use server" would register these auth helpers as public POST endpoints
  // (requireAuth returns the caller's full session); all importers are server modules.
  it("is not a server-action module", async () => {
    const source = await readFile(path.resolve(process.cwd(), "src/lib/team-auth.ts"), "utf8");
    expect(source).not.toContain('"use server"');
  });
});

describe("getTeamRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no session exists", async () => {
    mockedGetSession.mockResolvedValue(null);

    const result = await getTeamRole("team-1");
    expect(result).toBeNull();
  });

  it("returns null when no membership found", async () => {
    mockedGetSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedFindMembership.mockResolvedValue(null);

    const result = await getTeamRole("team-1");
    expect(result).toBeNull();
  });

  it("returns null when role is not a valid TeamRole", async () => {
    mockedGetSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedFindMembership.mockResolvedValue({ role: "INVALID_ROLE" } as never);

    const result = await getTeamRole("team-1");
    expect(result).toBeNull();
  });

  it("returns userId and role for valid ADMIN member", async () => {
    mockedGetSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedFindMembership.mockResolvedValue({ role: "ADMIN" } as never);

    const result = await getTeamRole("team-1");
    expect(result).toEqual({ role: "ADMIN", userId: "user-1" });
  });

  it("returns userId and role for valid MEMBER", async () => {
    mockedGetSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedFindMembership.mockResolvedValue({ role: "MEMBER" } as never);

    const result = await getTeamRole("team-1");
    expect(result).toEqual({ role: "MEMBER", userId: "user-1" });
  });
});

describe("requireTeamAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when user is not a member", async () => {
    mockedGetSession.mockResolvedValue(null);

    await expect(requireTeamAdmin("team-1")).rejects.toThrow("Not a member of this team");
  });

  it("throws when user is MEMBER not ADMIN", async () => {
    mockedGetSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedFindMembership.mockResolvedValue({ role: "MEMBER" } as never);

    await expect(requireTeamAdmin("team-1")).rejects.toThrow("Admin access required");
  });

  it("returns userId when user is ADMIN", async () => {
    mockedGetSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedFindMembership.mockResolvedValue({ role: "ADMIN" } as never);

    const result = await requireTeamAdmin("team-1");
    expect(result).toBe("user-1");
  });
});

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when no session exists", async () => {
    mockedGetSession.mockResolvedValue(null);

    await expect(requireAuth()).rejects.toThrow("Authentication required");
  });

  it("returns session when authenticated", async () => {
    const session = { user: { email: "test@test.com", id: "user-1" } };
    mockedGetSession.mockResolvedValue(session as never);

    const result = await requireAuth();
    expect(result).toEqual(session);
  });
});
