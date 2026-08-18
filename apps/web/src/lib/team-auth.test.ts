import { readFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { getSession } from "@/lib/auth-server";

import { createMockSession } from "./actions/test-helpers";
import { createTeamAuth } from "./team-auth";

const mockedGetSession = vi.fn<typeof getSession>();
const mockedFindMembership = vi.fn<Parameters<typeof createTeamAuth>[0]["findMembership"]>();
const { getTeamRole, requireAuth, requireTeamAdmin, requireTeamMember } = createTeamAuth({
  findMembership: mockedFindMembership,
  getSession: mockedGetSession,
});

describe("module surface", () => {
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
    mockedGetSession.mockResolvedValue(createMockSession({ userId: "user-1" }));
    mockedFindMembership.mockResolvedValue(null);

    const result = await getTeamRole("team-1");
    expect(result).toBeNull();
  });

  it("returns null when role is not a valid TeamRole", async () => {
    mockedGetSession.mockResolvedValue(createMockSession({ userId: "user-1" }));
    mockedFindMembership.mockResolvedValue({ role: "INVALID_ROLE" });

    const result = await getTeamRole("team-1");
    expect(result).toBeNull();
  });

  it("returns userId and role for valid ADMIN member", async () => {
    mockedGetSession.mockResolvedValue(createMockSession({ userId: "user-1" }));
    mockedFindMembership.mockResolvedValue({ role: "ADMIN" });

    const result = await getTeamRole("team-1");
    expect(result).toEqual({ role: "ADMIN", userId: "user-1" });
  });

  it("returns userId and role for valid MEMBER", async () => {
    mockedGetSession.mockResolvedValue(createMockSession({ userId: "user-1" }));
    mockedFindMembership.mockResolvedValue({ role: "MEMBER" });

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
    mockedGetSession.mockResolvedValue(createMockSession({ userId: "user-1" }));
    mockedFindMembership.mockResolvedValue({ role: "MEMBER" });

    await expect(requireTeamAdmin("team-1")).rejects.toThrow("Admin access required");
  });

  it("returns userId when user is ADMIN", async () => {
    mockedGetSession.mockResolvedValue(createMockSession({ userId: "user-1" }));
    mockedFindMembership.mockResolvedValue({ role: "ADMIN" });

    const result = await requireTeamAdmin("team-1");
    expect(result).toBe("user-1");
  });
});

describe("requireTeamMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when user is not a member", async () => {
    mockedGetSession.mockResolvedValue(null);

    await expect(requireTeamMember("team-1")).rejects.toThrow("Not a member of this team");
  });

  it("returns userId when user is MEMBER", async () => {
    mockedGetSession.mockResolvedValue(createMockSession({ userId: "user-1" }));
    mockedFindMembership.mockResolvedValue({ role: "MEMBER" });

    const result = await requireTeamMember("team-1");
    expect(result).toBe("user-1");
  });

  it("returns userId when user is ADMIN", async () => {
    mockedGetSession.mockResolvedValue(createMockSession({ userId: "user-1" }));
    mockedFindMembership.mockResolvedValue({ role: "ADMIN" });

    const result = await requireTeamMember("team-1");
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
    const session = createMockSession({ email: "test@test.com", userId: "user-1" });
    mockedGetSession.mockResolvedValue(session);

    const result = await requireAuth();
    expect(result).toEqual(session);
  });
});
