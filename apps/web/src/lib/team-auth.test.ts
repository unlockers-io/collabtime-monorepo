import { readFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { getSession } from "@/lib/auth-server";

import { createMockSession, VALID_UUID } from "./actions/test-helpers";
import { createTeamAuth } from "./team-auth";
import { issueAccessCookie } from "./workspace-access";
import { createTestAccessStore } from "./workspace-access-test-store";

const HASH = "$2b$10$abcdefghijklmnopqrstuv";

const privateSpace = {
  accessPassword: HASH,
  id: "space-1",
  isPrivate: true,
  ownerId: "owner-1",
  teamId: VALID_UUID,
};

type TeamAuthDeps = Parameters<typeof createTeamAuth>[0];

const mockedGetSession = vi.fn<typeof getSession>();
const mockedFindMembership = vi.fn<TeamAuthDeps["findMembership"]>();
const reportError = vi.fn<TeamAuthDeps["reportError"]>();

const { authenticate, authorizeTeamAdmin, authorizeTeamMember } = createTeamAuth({
  findMembership: mockedFindMembership,
  getSession: mockedGetSession,
  readAccessToken: vi.fn<TeamAuthDeps["readAccessToken"]>(),
  reportError,
});

describe("module surface", () => {
  it("is not a server-action module", async () => {
    const source = await readFile(path.resolve(process.cwd(), "src/lib/team-auth.ts"), "utf8");
    expect(source).not.toContain('"use server"');
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
    mockedFindMembership.mockResolvedValue({ archivedAt: null, role: "ADMIN" });

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
    mockedFindMembership.mockResolvedValue({ archivedAt: null, role: "MEMBER" });
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

describe("captureAccessCheck", () => {
  it("reads the cookie once and rechecks the current password and membership", async () => {
    vi.stubEnv("SPACE_ACCESS_SECRET", "test-space-secret-at-least-32-characters");
    const access = createTestAccessStore();
    access.setToken(privateSpace.id, issueAccessCookie(privateSpace.id, HASH).value);
    const canView = await access.auth.captureAccessCheck(privateSpace.id, "user-1");

    expect(await canView(privateSpace)).toBe(true);
    expect(await canView({ ...privateSpace, accessPassword: "rotated-hash" })).toBe(false);
    access.addMembership(VALID_UUID, "user-1");
    expect(await canView({ ...privateSpace, accessPassword: "rotated-hash" })).toBe(true);
    access.removeMembership(VALID_UUID, "user-1");
    expect(await canView({ ...privateSpace, accessPassword: "rotated-hash" })).toBe(false);
    expect(access.store.readAccessToken).toHaveBeenCalledOnce();
    vi.unstubAllEnvs();
  });
});
