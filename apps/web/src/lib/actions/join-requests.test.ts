import { beforeEach, describe, expect, it, vi } from "vitest";

import * as joinRequests from "./join-requests";
import { createJoinRequestActions } from "./join-requests-core";
import { createTestGuards, VALID_UUID, VALID_UUID_2 } from "./test-helpers";

type JoinRequestDeps = Parameters<typeof createJoinRequestActions>[0];

const ensureMemberSlot = vi.fn<JoinRequestDeps["ensureMemberSlot"]>();
const notifyAdmins = vi.fn<JoinRequestDeps["notifyAdmins"]>();
const notifyRequester = vi.fn<JoinRequestDeps["notifyRequester"]>();
const approveMembership = vi.fn<JoinRequestDeps["approveMembership"]>();
const denyRequest = vi.fn<JoinRequestDeps["denyRequest"]>();
const findRequest = vi.fn<JoinRequestDeps["findRequest"]>();
const listPending = vi.fn<JoinRequestDeps["listPending"]>();
const loadJoinContext = vi.fn<JoinRequestDeps["loadJoinContext"]>();
const reportError = vi.fn<JoinRequestDeps["reportError"]>();
const guards = createTestGuards();
const upsertRequest = vi.fn<JoinRequestDeps["upsertRequest"]>();
const { approveJoinRequest, denyJoinRequest, getPendingJoinRequests, requestToJoin } =
  createJoinRequestActions({
    approveMembership,
    authenticate: guards.authenticate,
    authorizeTeamAdmin: guards.authorizeTeamAdmin,
    denyRequest,
    ensureMemberSlot,
    findRequest,
    listPending,
    loadJoinContext,
    notifyAdmins,
    notifyRequester,
    reportError,
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
  ensureMemberSlot.mockResolvedValue({ created: true, memberId: "member-1", ok: true });
  approveMembership.mockResolvedValue();
  denyRequest.mockResolvedValue();
  findRequest.mockResolvedValue(pendingRequest);
  listPending.mockResolvedValue({ memberUserIds: [], requests: [] });
  loadJoinContext.mockResolvedValue({
    existingMembership: false,
    existingRequest: null,
    teamExists: true,
  });
  guards.reset();
  upsertRequest.mockResolvedValue({ id: "jr-1" });
});

describe("requestToJoin", () => {
  it("requires a session before loading the team", async () => {
    guards.authenticate.mockResolvedValue({ error: "Authentication required", success: false });

    expect(await requestToJoin(VALID_UUID)).toEqual({
      error: "Authentication required",
      success: false,
    });
    expect(loadJoinContext).not.toHaveBeenCalled();
  });

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
    expect(notifyAdmins).toHaveBeenCalledWith(
      VALID_UUID,
      expect.objectContaining({ email: "test@example.com" }),
    );
  });
});

describe("join request decisions", () => {
  it.each([
    ["approveJoinRequest", approveJoinRequest],
    ["denyJoinRequest", denyJoinRequest],
  ])("%s refuses a non-admin before looking the request up", async (_name, decide) => {
    guards.authorizeTeamAdmin.mockResolvedValue({ error: "Admin access required", success: false });

    expect(await decide(VALID_UUID, "jr-1")).toEqual({
      error: "Admin access required",
      success: false,
    });
    expect(findRequest).not.toHaveBeenCalled();
    expect(approveMembership).not.toHaveBeenCalled();
    expect(denyRequest).not.toHaveBeenCalled();
  });

  it.each([
    ["approveJoinRequest", approveJoinRequest],
    ["denyJoinRequest", denyJoinRequest],
  ])("%s treats another team's request as missing", async (_name, decide) => {
    expect(await decide(VALID_UUID_2, "jr-1")).toEqual({
      error: "Join request not found",
      success: false,
    });
    expect(guards.authorizeTeamAdmin).toHaveBeenCalledWith(VALID_UUID_2);
    expect(approveMembership).not.toHaveBeenCalled();
    expect(denyRequest).not.toHaveBeenCalled();
  });
});

describe("approveJoinRequest", () => {
  it("returns error when request not found", async () => {
    findRequest.mockResolvedValue(null);

    expect(await approveJoinRequest(VALID_UUID, "jr-1")).toEqual({
      error: "Join request not found",
      success: false,
    });
  });

  it("returns error when request is no longer pending", async () => {
    findRequest.mockResolvedValue({ ...pendingRequest, status: "APPROVED" });

    expect(await approveJoinRequest(VALID_UUID, "jr-1")).toEqual({
      error: "Join request is no longer pending",
      success: false,
    });
  });

  it("requires an admin and commits the membership", async () => {
    const result = await approveJoinRequest(VALID_UUID, "jr-1");

    expect(guards.authorizeTeamAdmin).toHaveBeenCalledWith(VALID_UUID);
    expect(approveMembership).toHaveBeenCalledWith("jr-1", VALID_UUID, "user-456");
    expect(result).toEqual({ data: { memberId: "member-1" }, success: true });
  });

  it("persists the member before approval", async () => {
    await approveJoinRequest(VALID_UUID, "jr-1");

    expect(ensureMemberSlot).toHaveBeenCalledWith(VALID_UUID, "user-456", "Bob");
    expect(ensureMemberSlot.mock.invocationCallOrder[0]).toBeLessThan(
      approveMembership.mock.invocationCallOrder[0],
    );
    expect(notifyRequester).toHaveBeenCalledWith(pendingRequest, "approved");
  });

  it("reports a failed member write", async () => {
    ensureMemberSlot.mockResolvedValue({
      error: "Failed to save the team",
      ok: false,
      reason: "write-failed",
    });

    const result = await approveJoinRequest(VALID_UUID, "jr-1");
    expect(result.success).toBe(false);
    expect(approveMembership).not.toHaveBeenCalled();
    expect(notifyRequester).not.toHaveBeenCalled();
  });

  it("distinguishes an unreachable team", async () => {
    ensureMemberSlot.mockResolvedValue({
      error: "Could not read the team",
      ok: false,
      reason: "read-failed",
    });

    expect(await approveJoinRequest(VALID_UUID, "jr-1")).toEqual({
      error: "Could not read the team",
      success: false,
    });
  });
});

describe("denyJoinRequest", () => {
  it("returns error when request not found", async () => {
    findRequest.mockResolvedValue(null);

    expect(await denyJoinRequest(VALID_UUID, "jr-1")).toEqual({
      error: "Join request not found",
      success: false,
    });
  });

  it("updates a pending request to denied", async () => {
    expect(await denyJoinRequest(VALID_UUID, "jr-1")).toEqual({ data: undefined, success: true });
    expect(denyRequest).toHaveBeenCalledWith("jr-1");
    expect(notifyRequester).toHaveBeenCalledWith(pendingRequest, "denied");
  });
});

describe("getPendingJoinRequests", () => {
  it("requires team admin", async () => {
    guards.authorizeTeamAdmin.mockResolvedValue({ error: "Admin access required", success: false });

    expect(await getPendingJoinRequests(VALID_UUID)).toEqual({
      error: "Admin access required",
      success: false,
    });
    expect(listPending).not.toHaveBeenCalled();
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
