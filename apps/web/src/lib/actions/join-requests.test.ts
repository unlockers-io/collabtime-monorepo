import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSession, createTestTeamRecord, VALID_UUID } from "./test-helpers";

vi.mock("@/lib/team-auth", () => ({
  requireAuth: vi.fn(),
  requireTeamAdmin: vi.fn(),
}));
vi.mock("@repo/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    joinRequest: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    membership: { create: vi.fn(), findUnique: vi.fn() },
  },
}));
const { redisMock } = vi.hoisted(() => ({
  redisMock: { expire: vi.fn(), get: vi.fn(), set: vi.fn() },
}));

vi.mock("../redis", () => ({
  isRedisConfigured: (): boolean => true,
  readTeamJson: async (teamId: string): Promise<string | null> => {
    const data: unknown = await redisMock.get(`team:${teamId}`);
    return typeof data === "string" && data !== "" ? data : null;
  },
  redis: redisMock,
  TEAM_ACTIVE_TTL_SECONDS: 100,
  teamKey: (teamId: string): string => `team:${teamId}`,
}));
vi.mock("../team-mirror", () => ({ writeTeamMirror: vi.fn() }));
vi.mock("uuid", () => ({ v4: vi.fn(() => "test-uuid") }));

import { prisma } from "@repo/db";

import { requireAuth, requireTeamAdmin } from "@/lib/team-auth";

import * as joinRequests from "./join-requests";

const { approveJoinRequest, denyJoinRequest, getPendingJoinRequests, requestToJoin } = joinRequests;

const storedTeam = (team = createTestTeamRecord()) => {
  redisMock.get.mockResolvedValue(JSON.stringify(team));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(createMockSession() as never);
  vi.mocked(requireTeamAdmin).mockResolvedValue(undefined as never);
  redisMock.set.mockResolvedValue("OK");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("requestToJoin", () => {
  it("returns error when team not found", async () => {
    redisMock.get.mockResolvedValue(null);

    const result = await requestToJoin(VALID_UUID);

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("returns error when already a member", async () => {
    storedTeam();
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ id: "m-1" } as never);

    const result = await requestToJoin(VALID_UUID);

    expect(result).toEqual({ error: "You are already a member of this team", success: false });
  });

  it("returns error when already has pending request", async () => {
    storedTeam();
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue({ status: "PENDING" } as never);

    const result = await requestToJoin(VALID_UUID);

    expect(result).toEqual({
      error: "You already have a pending request for this team",
      success: false,
    });
  });

  it("creates join request via upsert on success", async () => {
    storedTeam();
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.joinRequest.upsert).mockResolvedValue({ id: "jr-1" } as never);

    const result = await requestToJoin(VALID_UUID);

    expect(result).toEqual({ data: { requestId: "jr-1" }, success: true });
    expect(prisma.joinRequest.upsert).toHaveBeenCalled();
  });
});

describe("approveJoinRequest", () => {
  const pendingRequest = {
    id: "jr-1",
    status: "PENDING",
    teamId: VALID_UUID,
    user: { email: "bob@example.com", name: "Bob" },
    userId: "user-456",
  };

  it("returns error when request not found", async () => {
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue(null);

    const result = await approveJoinRequest("jr-1");

    expect(result).toEqual({ error: "Join request not found", success: false });
  });

  it("returns error when request is not PENDING", async () => {
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue({
      ...pendingRequest,
      status: "APPROVED",
    } as never);

    const result = await approveJoinRequest("jr-1");

    expect(result).toEqual({ error: "Join request is no longer pending", success: false });
  });

  it("requires admin of the request's team", async () => {
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue(pendingRequest as never);
    vi.mocked(requireTeamAdmin).mockRejectedValue(new Error("Not admin"));

    const result = await approveJoinRequest("jr-1");

    expect(requireTeamAdmin).toHaveBeenCalledWith(VALID_UUID);
    expect(result).toEqual({ error: "Failed to approve join request", success: false });
  });

  it("creates membership and updates status in transaction", async () => {
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue(pendingRequest as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    storedTeam();

    const result = await approveJoinRequest("jr-1");

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memberId).toBe("test-uuid");
    }
  });

  it("persists the claimed member slot after approval", async () => {
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue(pendingRequest as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    storedTeam();

    await approveJoinRequest("jr-1");

    const written = JSON.parse(redisMock.set.mock.calls[0][1] as string) as {
      members: Array<{ id: string; userId: string }>;
    };
    expect(written.members).toEqual([
      expect.objectContaining({ id: "test-uuid", userId: "user-456" }),
    ]);
  });

  it("does not report success when the member write fails", async () => {
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue(pendingRequest as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    storedTeam();
    redisMock.set.mockRejectedValue(new Error("redis down"));

    const result = await approveJoinRequest("jr-1");

    expect(result.success).toBe(false);
  });

  it("does not report success when the team has no contents record", async () => {
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue(pendingRequest as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    redisMock.get.mockResolvedValue(null);

    const result = await approveJoinRequest("jr-1");

    expect(result.success).toBe(false);
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("says the team was unreachable when the read failed, not that it is missing", async () => {
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue(pendingRequest as never);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    redisMock.get.mockRejectedValue(new Error("redis down"));

    const result = await approveJoinRequest("jr-1");

    expect(result).toEqual({
      error: "The request was approved, but the team could not be reached. Try again in a moment.",
      success: false,
    });
  });
});

describe("denyJoinRequest", () => {
  const pendingRequest = {
    id: "jr-1",
    status: "PENDING",
    teamId: VALID_UUID,
    userId: "user-456",
  };

  it("returns error when request not found", async () => {
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue(null);

    const result = await denyJoinRequest("jr-1");

    expect(result).toEqual({ error: "Join request not found", success: false });
  });

  it("returns error when not PENDING", async () => {
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue({
      ...pendingRequest,
      status: "DENIED",
    } as never);

    const result = await denyJoinRequest("jr-1");

    expect(result).toEqual({ error: "Join request is no longer pending", success: false });
  });

  it("updates status to DENIED", async () => {
    vi.mocked(prisma.joinRequest.findUnique).mockResolvedValue(pendingRequest as never);
    vi.mocked(prisma.joinRequest.update).mockResolvedValue(undefined as never);

    const result = await denyJoinRequest("jr-1");

    expect(prisma.joinRequest.update).toHaveBeenCalledWith({
      data: { status: "DENIED" },
      where: { id: "jr-1" },
    });
    expect(result).toEqual({ data: undefined, success: true });
  });
});

describe("getPendingJoinRequests", () => {
  it("requires team admin", async () => {
    vi.mocked(requireTeamAdmin).mockRejectedValue(new Error("Not admin"));

    const result = await getPendingJoinRequests(VALID_UUID);

    expect(requireTeamAdmin).toHaveBeenCalledWith(VALID_UUID);
    expect(result).toEqual({ error: "Failed to get join requests", success: false });
  });

  it("returns formatted pending requests with user info", async () => {
    const createdAt = new Date("2026-01-15");
    vi.mocked(prisma.joinRequest.findMany).mockResolvedValue([
      {
        createdAt,
        id: "jr-1",
        user: { email: "bob@example.com", id: "user-456", name: "Bob" },
        userId: "user-456",
      },
    ] as never);

    const result = await getPendingJoinRequests(VALID_UUID);

    expect(result).toEqual({
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
