import { db, joinRequest, membership, space, user } from "@repo/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSession, createTestTeamRecord } from "./test-helpers";

vi.mock("@/lib/team-auth", () => ({
  getTeamRole: vi.fn(),
  requireAuth: vi.fn(),
  requireTeamAdmin: vi.fn(),
}));
vi.mock("../redis", () => ({
  redis: { get: vi.fn(), set: vi.fn() },
  TEAM_ACTIVE_TTL_SECONDS: 100,
}));
vi.mock("./helpers", () => ({ getTeamRecord: vi.fn() }));
vi.mock("uuid", () => ({ v4: vi.fn(() => "test-uuid") }));

import { getTeamRole, requireAuth, requireTeamAdmin } from "@/lib/team-auth";

import { getTeamRecord } from "./helpers";
import {
  approveJoinRequest,
  denyJoinRequest,
  getMyTeamStatus,
  getPendingJoinRequests,
  requestToJoin,
} from "./join-requests";

// Requester (the session user) and an existing team owner with a Space.
const REQUESTER_ID = "jr-requester";
const OWNER_ID = "jr-owner";
// File-unique team id (unique Space.teamId constraint forbids sharing across test files).
const TEAM_ID = "5d36d3bf-9170-45e4-9123-1d01d253ab77";
const SPACE_ID = "jr-space";

const now = () => new Date().toISOString();

const resetState = async () => {
  await db.delete(joinRequest).where(eq(joinRequest.teamId, TEAM_ID));
  await db.delete(membership).where(eq(membership.teamId, TEAM_ID));
};

beforeAll(async () => {
  await resetState();
  await db.delete(space).where(eq(space.id, SPACE_ID));
  await db.delete(user).where(eq(user.id, REQUESTER_ID));
  await db.delete(user).where(eq(user.id, OWNER_ID));

  await db.insert(user).values({
    email: "jr-requester@example.com",
    emailVerified: true,
    id: REQUESTER_ID,
    name: "Bob",
    updatedAt: now(),
  });
  await db.insert(user).values({
    email: "jr-owner@example.com",
    emailVerified: true,
    id: OWNER_ID,
    name: "Owner",
    updatedAt: now(),
  });
  await db.insert(space).values({
    id: SPACE_ID,
    ownerId: OWNER_ID,
    teamId: TEAM_ID,
    updatedAt: now(),
  });
});

afterAll(async () => {
  await resetState();
  await db.delete(space).where(eq(space.id, SPACE_ID));
  await db.delete(user).where(eq(user.id, REQUESTER_ID));
  await db.delete(user).where(eq(user.id, OWNER_ID));
});

const seedMembership = async (userId: string, role: "ADMIN" | "MEMBER") => {
  await db.insert(membership).values({
    id: `jr-membership-${userId}`,
    role,
    teamId: TEAM_ID,
    updatedAt: now(),
    userId,
  });
};

const seedJoinRequest = async (
  userId: string,
  status: "APPROVED" | "DENIED" | "PENDING",
  id = `jr-${userId}`,
) => {
  await db.insert(joinRequest).values({
    id,
    status,
    teamId: TEAM_ID,
    updatedAt: now(),
    userId,
  });
  return id;
};

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(createMockSession({ userId: REQUESTER_ID }) as never);
  vi.mocked(requireTeamAdmin).mockResolvedValue(undefined as never);
  vi.spyOn(console, "error").mockImplementation(() => {});
  await resetState();
});

describe("requestToJoin", () => {
  it("returns error when team not found", async () => {
    vi.mocked(getTeamRecord).mockResolvedValue(null as never);

    const result = await requestToJoin(TEAM_ID);

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("returns error when already a member", async () => {
    vi.mocked(getTeamRecord).mockResolvedValue(createTestTeamRecord() as never);
    await seedMembership(REQUESTER_ID, "MEMBER");

    const result = await requestToJoin(TEAM_ID);

    expect(result).toEqual({ error: "You are already a member of this team", success: false });
  });

  it("returns error when already has pending request", async () => {
    vi.mocked(getTeamRecord).mockResolvedValue(createTestTeamRecord() as never);
    await seedJoinRequest(REQUESTER_ID, "PENDING");

    const result = await requestToJoin(TEAM_ID);

    expect(result).toEqual({
      error: "You already have a pending request for this team",
      success: false,
    });
  });

  it("creates a PENDING join request on success", async () => {
    vi.mocked(getTeamRecord).mockResolvedValue(createTestTeamRecord() as never);

    const result = await requestToJoin(TEAM_ID);

    expect(result.success).toBe(true);
    const row = await db.query.joinRequest.findFirst({
      where: eq(joinRequest.userId, REQUESTER_ID),
    });
    expect(row?.status).toBe("PENDING");
    if (result.success) {
      expect(result.data.requestId).toBe(row?.id);
    }
  });
});

describe("approveJoinRequest", () => {
  it("returns error when request not found", async () => {
    const result = await approveJoinRequest("does-not-exist");

    expect(result).toEqual({ error: "Join request not found", success: false });
  });

  it("returns error when request is not PENDING", async () => {
    const id = await seedJoinRequest(REQUESTER_ID, "APPROVED");

    const result = await approveJoinRequest(id);

    expect(result).toEqual({ error: "Join request is no longer pending", success: false });
  });

  it("requires admin of the request's team", async () => {
    const id = await seedJoinRequest(REQUESTER_ID, "PENDING");
    vi.mocked(requireTeamAdmin).mockRejectedValue(new Error("Not admin") as never);

    const result = await approveJoinRequest(id);

    expect(requireTeamAdmin).toHaveBeenCalledWith(TEAM_ID);
    expect(result).toEqual({ error: "Failed to approve join request", success: false });
  });

  it("creates membership and marks request APPROVED in a transaction", async () => {
    const id = await seedJoinRequest(REQUESTER_ID, "PENDING");
    vi.mocked(getTeamRecord).mockResolvedValue(createTestTeamRecord() as never);

    const result = await approveJoinRequest(id);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memberId).toBe("test-uuid");
    }
    const request = await db.query.joinRequest.findFirst({ where: eq(joinRequest.id, id) });
    expect(request?.status).toBe("APPROVED");
    const created = await db.query.membership.findFirst({
      where: eq(membership.userId, REQUESTER_ID),
    });
    expect(created?.role).toBe("MEMBER");
  });

  it("adds member to Redis cache after approval", async () => {
    const { redis } = await import("../redis");
    const id = await seedJoinRequest(REQUESTER_ID, "PENDING");
    vi.mocked(getTeamRecord).mockResolvedValue(createTestTeamRecord() as never);

    await approveJoinRequest(id);

    expect(redis.set).toHaveBeenCalled();
  });
});

describe("denyJoinRequest", () => {
  it("returns error when request not found", async () => {
    const result = await denyJoinRequest("does-not-exist");

    expect(result).toEqual({ error: "Join request not found", success: false });
  });

  it("returns error when not PENDING", async () => {
    const id = await seedJoinRequest(REQUESTER_ID, "DENIED");

    const result = await denyJoinRequest(id);

    expect(result).toEqual({ error: "Join request is no longer pending", success: false });
  });

  it("updates status to DENIED", async () => {
    const id = await seedJoinRequest(REQUESTER_ID, "PENDING");

    const result = await denyJoinRequest(id);

    expect(result).toEqual({ data: undefined, success: true });
    const row = await db.query.joinRequest.findFirst({ where: eq(joinRequest.id, id) });
    expect(row?.status).toBe("DENIED");
  });
});

describe("getPendingJoinRequests", () => {
  it("requires team admin", async () => {
    vi.mocked(requireTeamAdmin).mockRejectedValue(new Error("Not admin") as never);

    const result = await getPendingJoinRequests(TEAM_ID);

    expect(requireTeamAdmin).toHaveBeenCalledWith(TEAM_ID);
    expect(result).toEqual({ error: "Failed to get join requests", success: false });
  });

  it("returns formatted pending requests with user info", async () => {
    await seedJoinRequest(REQUESTER_ID, "PENDING");

    const result = await getPendingJoinRequests(TEAM_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        userEmail: "jr-requester@example.com",
        userId: REQUESTER_ID,
        userName: "Bob",
      });
      expect(result.data[0].createdAt).toBeInstanceOf(Date);
    }
  });
});

describe("getMyTeamStatus", () => {
  it("returns role when user is a team member", async () => {
    vi.mocked(getTeamRole).mockResolvedValue({ role: "ADMIN" } as never);

    const result = await getMyTeamStatus(TEAM_ID);

    expect(result).toEqual({ data: { status: "ADMIN" }, success: true });
  });

  it("returns PENDING when user has pending request", async () => {
    vi.mocked(getTeamRole).mockResolvedValue(null as never);
    await seedJoinRequest(REQUESTER_ID, "PENDING");

    const result = await getMyTeamStatus(TEAM_ID);

    expect(result).toEqual({ data: { status: "PENDING" }, success: true });
  });

  it("returns none when user has no relationship", async () => {
    vi.mocked(getTeamRole).mockResolvedValue(null as never);

    const result = await getMyTeamStatus(TEAM_ID);

    expect(result).toEqual({ data: { status: "none" }, success: true });
  });
});
