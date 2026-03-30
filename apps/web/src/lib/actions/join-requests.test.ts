import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSession, createTestTeamRecord, VALID_UUID } from "./test-helpers";

vi.mock("@/lib/team-auth", () => ({
  requireAuth: vi.fn(),
  requireTeamAdmin: vi.fn(),
  getTeamRole: vi.fn(),
}));
vi.mock("@repo/db", () => ({
  prisma: {
    membership: { findUnique: vi.fn(), create: vi.fn() },
    joinRequest: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("../redis", () => ({
  redis: { get: vi.fn(), set: vi.fn() },
  TEAM_ACTIVE_TTL_SECONDS: 100,
}));
vi.mock("../realtime", () => ({
  realtime: { channel: vi.fn(() => ({ emit: vi.fn(() => Promise.resolve()) })) },
}));
vi.mock("./helpers", () => ({ getTeamRecord: vi.fn() }));
vi.mock("uuid", () => ({ v4: vi.fn(() => "test-uuid") }));

import { prisma } from "@repo/db";

import { getTeamRole, requireAuth, requireTeamAdmin } from "@/lib/team-auth";

import { getTeamRecord } from "./helpers";
import {
  approveJoinRequest,
  denyJoinRequest,
  getMyTeamStatus,
  getPendingJoinRequests,
  requestToJoin,
} from "./join-requests";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(createMockSession() as never);
  vi.mocked(requireTeamAdmin).mockResolvedValue(undefined as never);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("requestToJoin", () => {
  it("returns error when team not found", async () => {
    vi.mocked(getTeamRecord).mockResolvedValue(null as never);

    const result = await requestToJoin(VALID_UUID);

    expect(result).toEqual({ success: false, error: "Team not found" });
  });

  it("returns error when already a member", async () => {
    vi.mocked(getTeamRecord).mockResolvedValue(createTestTeamRecord() as never);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ id: "m-1" } as never);

    const result = await requestToJoin(VALID_UUID);

    expect(result).toEqual({ success: false, error: "You are already a member of this team" });
  });

  it("returns error when already has pending request", async () => {
    vi.mocked(getTeamRecord).mockResolvedValue(createTestTeamRecord() as never);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue({ status: "PENDING" } as never);

    const result = await requestToJoin(VALID_UUID);

    expect(result).toEqual({
      success: false,
      error: "You already have a pending request for this team",
    });
  });

  it("creates join request via upsert on success", async () => {
    vi.mocked(getTeamRecord).mockResolvedValue(createTestTeamRecord() as never);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.joinRequest.upsert).mockResolvedValue({ id: "jr-1" } as never);

    const result = await requestToJoin(VALID_UUID);

    expect(result).toEqual({ success: true, data: { requestId: "jr-1" } });
    expect(prisma.joinRequest.upsert).toHaveBeenCalled();
  });
});

describe("approveJoinRequest", () => {
  const pendingRequest = {
    id: "jr-1",
    userId: "user-456",
    teamId: VALID_UUID,
    status: "PENDING",
    user: { name: "Bob", email: "bob@example.com" },
  };

  it("returns error when request not found", async () => {
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue(null as never);

    const result = await approveJoinRequest("jr-1");

    expect(result).toEqual({ success: false, error: "Join request not found" });
  });

  it("returns error when request is not PENDING", async () => {
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue({
      ...pendingRequest,
      status: "APPROVED",
    } as never);

    const result = await approveJoinRequest("jr-1");

    expect(result).toEqual({ success: false, error: "Join request is no longer pending" });
  });

  it("requires admin of the request's team", async () => {
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue(pendingRequest as never);
    vi.mocked(requireTeamAdmin).mockRejectedValue(new Error("Not admin") as never);

    const result = await approveJoinRequest("jr-1");

    expect(requireTeamAdmin).toHaveBeenCalledWith(VALID_UUID);
    expect(result).toEqual({ success: false, error: "Failed to approve join request" });
  });

  it("creates membership and updates status in transaction", async () => {
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue(pendingRequest as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined as never);
    vi.mocked(getTeamRecord).mockResolvedValue(createTestTeamRecord() as never);

    const result = await approveJoinRequest("jr-1");

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memberId).toBe("test-uuid");
    }
  });

  it("adds member to Redis and emits realtime event", async () => {
    const { redis } = await import("../redis");
    const { realtime } = await import("../realtime");

    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue(pendingRequest as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined as never);
    vi.mocked(getTeamRecord).mockResolvedValue(createTestTeamRecord() as never);

    await approveJoinRequest("jr-1");

    expect(redis.set).toHaveBeenCalled();
    expect(realtime.channel).toHaveBeenCalledWith(`team-${VALID_UUID}`);
  });
});

describe("denyJoinRequest", () => {
  const pendingRequest = {
    id: "jr-1",
    userId: "user-456",
    teamId: VALID_UUID,
    status: "PENDING",
  };

  it("returns error when request not found", async () => {
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue(null as never);

    const result = await denyJoinRequest("jr-1");

    expect(result).toEqual({ success: false, error: "Join request not found" });
  });

  it("returns error when not PENDING", async () => {
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue({
      ...pendingRequest,
      status: "DENIED",
    } as never);

    const result = await denyJoinRequest("jr-1");

    expect(result).toEqual({ success: false, error: "Join request is no longer pending" });
  });

  it("updates status to DENIED", async () => {
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue(pendingRequest as never);
    vi.mocked(prisma.joinRequest.update).mockResolvedValue(undefined as never);

    const result = await denyJoinRequest("jr-1");

    expect(prisma.joinRequest.update).toHaveBeenCalledWith({
      where: { id: "jr-1" },
      data: { status: "DENIED" },
    });
    expect(result).toEqual({ success: true, data: undefined });
  });
});

describe("getPendingJoinRequests", () => {
  it("requires team admin", async () => {
    vi.mocked(requireTeamAdmin).mockRejectedValue(new Error("Not admin") as never);

    const result = await getPendingJoinRequests(VALID_UUID);

    expect(requireTeamAdmin).toHaveBeenCalledWith(VALID_UUID);
    expect(result).toEqual({ success: false, error: "Failed to get join requests" });
  });

  it("returns formatted pending requests with user info", async () => {
    const createdAt = new Date("2026-01-15");
    vi.mocked(prisma.joinRequest.findMany).mockResolvedValue([
      {
        id: "jr-1",
        userId: "user-456",
        user: { id: "user-456", name: "Bob", email: "bob@example.com" },
        createdAt,
      },
    ] as never);

    const result = await getPendingJoinRequests(VALID_UUID);

    expect(result).toEqual({
      success: true,
      data: [
        {
          id: "jr-1",
          userId: "user-456",
          userName: "Bob",
          userEmail: "bob@example.com",
          createdAt,
        },
      ],
    });
  });
});

describe("getMyTeamStatus", () => {
  it("returns role when user is a team member", async () => {
    vi.mocked(getTeamRole).mockResolvedValue({ role: "ADMIN" } as never);

    const result = await getMyTeamStatus(VALID_UUID);

    expect(result).toEqual({ success: true, data: { status: "ADMIN" } });
  });

  it("returns PENDING when user has pending request", async () => {
    vi.mocked(getTeamRole).mockResolvedValue(null as never);
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue({ status: "PENDING" } as never);

    const result = await getMyTeamStatus(VALID_UUID);

    expect(result).toEqual({ success: true, data: { status: "PENDING" } });
  });

  it("returns none when user has no relationship", async () => {
    vi.mocked(getTeamRole).mockResolvedValue(null as never);
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue(null as never);

    const result = await getMyTeamStatus(VALID_UUID);

    expect(result).toEqual({ success: true, data: { status: "none" } });
  });
});
