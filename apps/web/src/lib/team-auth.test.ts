import { readFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { getSession } from "@/lib/auth-server";

import { createMockSession, VALID_UUID } from "./actions/test-helpers";
import { createTeamAuth } from "./team-auth";

type TeamAuthDeps = Parameters<typeof createTeamAuth>[0];

const mockedGetSession = vi.fn<typeof getSession>();
const mockedFindMembership = vi.fn<TeamAuthDeps["findMembership"]>();
const reportError = vi.fn<TeamAuthDeps["reportError"]>();
const { authenticate, authorizeTeamAdmin, authorizeTeamMember, getTeamRole } = createTeamAuth({
  findMembership: mockedFindMembership,
  getSession: mockedGetSession,
  reportError,
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

describe("authenticate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses a request without a session", async () => {
    mockedGetSession.mockResolvedValue(null);

    expect(await authenticate()).toEqual({ error: "Authentication required", success: false });
  });

  it("returns the session user", async () => {
    const session = createMockSession({ email: "test@test.com", userId: "user-1" });
    mockedGetSession.mockResolvedValue(session);

    expect(await authenticate()).toEqual({ data: session.user, success: true });
  });
});

describe.each([
  ["authorizeTeamAdmin", authorizeTeamAdmin],
  ["authorizeTeamMember", authorizeTeamMember],
])("%s", (_name, authorize) => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a malformed team ID before reading the session", async () => {
    expect(await authorize("team-1")).toEqual({ error: "Invalid team ID", success: false });
    expect(mockedGetSession).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    mockedGetSession.mockResolvedValue(null);

    expect(await authorize(VALID_UUID)).toEqual({
      error: "Authentication required",
      success: false,
    });
    expect(mockedFindMembership).not.toHaveBeenCalled();
  });

  it("refuses a caller without a membership", async () => {
    mockedGetSession.mockResolvedValue(createMockSession({ userId: "user-1" }));
    mockedFindMembership.mockResolvedValue(null);

    expect(await authorize(VALID_UUID)).toEqual({
      error: "You are not a member of this team",
      success: false,
    });
  });

  it("grants an admin", async () => {
    const session = createMockSession({ userId: "user-1" });
    mockedGetSession.mockResolvedValue(session);
    mockedFindMembership.mockResolvedValue({ role: "ADMIN" });

    expect(await authorize(VALID_UUID)).toEqual({
      data: { teamId: VALID_UUID, user: session.user },
      success: true,
    });
    expect(mockedFindMembership).toHaveBeenCalledWith(VALID_UUID, "user-1");
  });

  it("reports a failed membership lookup instead of throwing", async () => {
    mockedGetSession.mockResolvedValue(createMockSession({ userId: "user-1" }));
    mockedFindMembership.mockRejectedValue(new Error("Database unavailable"));

    expect(await authorize(VALID_UUID)).toEqual({
      error: "Could not verify your access. Try again.",
      success: false,
    });
    expect(reportError).toHaveBeenCalledOnce();
  });
});

describe("member roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSession.mockResolvedValue(createMockSession({ userId: "user-1" }));
    mockedFindMembership.mockResolvedValue({ role: "MEMBER" });
  });

  it("refuses a member admin access", async () => {
    expect(await authorizeTeamAdmin(VALID_UUID)).toEqual({
      error: "Admin access required",
      success: false,
    });
  });

  it("grants a member member access", async () => {
    expect(await authorizeTeamMember(VALID_UUID)).toMatchObject({
      data: { teamId: VALID_UUID },
      success: true,
    });
  });
});
