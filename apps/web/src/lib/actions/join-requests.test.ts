import { beforeEach, describe, expect, it, vi } from "vitest";

import * as joinRequests from "./join-requests";
import { createJoinRequestActions } from "./join-requests-core";
import { createMockSession, VALID_UUID } from "./test-helpers";

type JoinRequestDeps = Parameters<typeof createJoinRequestActions>[0];

const addTeamMember = vi.fn<JoinRequestDeps["addTeamMember"]>();
const approveMembership = vi.fn<JoinRequestDeps["approveMembership"]>();
const denyRequest = vi.fn<JoinRequestDeps["denyRequest"]>();
const findRequest = vi.fn<JoinRequestDeps["findRequest"]>();
const listPending = vi.fn<JoinRequestDeps["listPending"]>();
const loadJoinContext = vi.fn<JoinRequestDeps["loadJoinContext"]>();
const reportError = vi.fn<JoinRequestDeps["reportError"]>();
const requireAuth = vi.fn<JoinRequestDeps["requireAuth"]>();
const requireTeamAdmin = vi.fn<JoinRequestDeps["requireTeamAdmin"]>();
const upsertRequest = vi.fn<JoinRequestDeps["upsertRequest"]>();
const { approveJoinRequest, denyJoinRequest, getPendingJoinRequests, requestToJoin } =
  createJoinRequestActions({
    addTeamMember,
    approveMembership,
    denyRequest,
    findRequest,
    listPending,
    loadJoinContext,
    reportError,
    requireAuth,
    requireTeamAdmin,
    upsertRequest,
  });

const pendingRequest = {
  id: "jr-1",
  status: "PENDING",
  teamId: VALID_UUID,
  user: { email: "bob@example.com", name: "Bob" },
  userId: "user-456",
};

beforeEach(() => {
  vi.clearAllMocks();
  addTeamMember.mockResolvedValue({ memberId: "member-1", ok: true });
  approveMembership.mockResolvedValue();
  denyRequest.mockResolvedValue();
  findRequest.mockResolvedValue(pendingRequest);
  listPending.mockResolvedValue({ memberUserIds: [], requests: [] });
  loadJoinContext.mockResolvedValue({
    existingMembership: false,
    existingRequest: null,
    teamExists: true,
  });
  requireAuth.mockResolvedValue(createMockSession());
  requireTeamAdmin.mockResolvedValue("admin-1");
  upsertRequest.mockResolvedValue({ id: "jr-1" });
});

describe("requestToJoin", () => {
  it("returns error when team not found", async () => {
    loadJoinContext.mockResolvedValue({
      existingMembership: false,
      existingRequest: null,
      teamExists: false,
    });

    expect(await requestToJoin(VALID_UUID)).toEqual({ error: "Team not found", success: false });
  });

  it("returns error when already a member", async () => {
    loadJoinContext.mockResolvedValue({
      existingMembership: true,
      existingRequest: null,
      teamExists: true,
    });

    expect(await requestToJoin(VALID_UUID)).toEqual({
      error: "You are already a member of this team",
      success: false,
    });
  });

  it("returns error when a pending request exists", async () => {
    loadJoinContext.mockResolvedValue({
      existingMembership: false,
      existingRequest: { status: "PENDING" },
      teamExists: true,
    });

    expect(await requestToJoin(VALID_UUID)).toEqual({
      error: "You already have a pending request for this team",
      success: false,
    });
  });

  it("upserts a request on success", async () => {
    expect(await requestToJoin(VALID_UUID)).toEqual({
      data: { requestId: "jr-1" },
      success: true,
    });
    expect(upsertRequest).toHaveBeenCalledWith(VALID_UUID, "user-123");
  });
});

describe("approveJoinRequest", () => {
  it("returns error when request not found", async () => {
    findRequest.mockResolvedValue(null);

    expect(await approveJoinRequest("jr-1")).toEqual({
      error: "Join request not found",
      success: false,
    });
  });

  it("returns error when request is no longer pending", async () => {
    findRequest.mockResolvedValue({ ...pendingRequest, status: "APPROVED" });

    expect(await approveJoinRequest("jr-1")).toEqual({
      error: "Join request is no longer pending",
      success: false,
    });
  });

  it("requires an admin and commits the membership", async () => {
    const result = await approveJoinRequest("jr-1");

    expect(requireTeamAdmin).toHaveBeenCalledWith(VALID_UUID);
    expect(approveMembership).toHaveBeenCalledWith("jr-1", VALID_UUID, "user-456");
    expect(result).toEqual({ data: { memberId: "member-1" }, success: true });
  });

  it("persists the member after approval", async () => {
    await approveJoinRequest("jr-1");

    expect(addTeamMember).toHaveBeenCalledWith(VALID_UUID, "user-456", "Bob");
  });

  it("reports a failed member write", async () => {
    addTeamMember.mockResolvedValue({ ok: false, reason: "write-failed" });

    const result = await approveJoinRequest("jr-1");
    expect(result.success).toBe(false);
  });

  it("distinguishes an unreachable team", async () => {
    addTeamMember.mockResolvedValue({ ok: false, reason: "read-failed" });

    expect(await approveJoinRequest("jr-1")).toEqual({
      error: "The request was approved, but the team could not be reached. Try again in a moment.",
      success: false,
    });
  });
});

describe("denyJoinRequest", () => {
  it("returns error when request not found", async () => {
    findRequest.mockResolvedValue(null);

    expect(await denyJoinRequest("jr-1")).toEqual({
      error: "Join request not found",
      success: false,
    });
  });

  it("updates a pending request to denied", async () => {
    expect(await denyJoinRequest("jr-1")).toEqual({ data: undefined, success: true });
    expect(denyRequest).toHaveBeenCalledWith("jr-1");
  });
});

describe("getPendingJoinRequests", () => {
  it("requires team admin", async () => {
    requireTeamAdmin.mockRejectedValue(new Error("Not admin"));

    expect(await getPendingJoinRequests(VALID_UUID)).toEqual({
      error: "Failed to get join requests",
      success: false,
    });
  });

  it("formats pending requests and hides existing members", async () => {
    const createdAt = new Date("2026-01-15");
    listPending.mockResolvedValue({
      memberUserIds: ["existing-user"],
      requests: [
        { ...pendingRequest, createdAt },
        {
          ...pendingRequest,
          createdAt,
          id: "jr-2",
          user: { email: "member@example.com", name: null },
          userId: "existing-user",
        },
      ],
    });

    expect(await getPendingJoinRequests(VALID_UUID)).toEqual({
      data: [
        {
          createdAt,
          id: "jr-1",
          userEmail: "bob@example.com",
          userId: "user-456",
          userName: "Bob",
        },
      ],
      success: true,
    });
  });
});

describe("module surface", () => {
  it("does not expose getMyTeamStatus as a server action", () => {
    expect(Object.keys(joinRequests)).not.toContain("getMyTeamStatus");
  });
});
