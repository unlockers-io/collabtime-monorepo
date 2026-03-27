import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAuth, requireTeamAdmin } from "@/lib/team-auth";

import {
  createMockSession,
  createTestMember,
  createTestTeamRecord,
  VALID_UUID,
  VALID_UUID_2,
  VALID_UUID_3,
} from "./test-helpers";

vi.mock("@/lib/team-auth", () => ({
  requireTeamAdmin: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: { membership: { findUnique: vi.fn() } },
}));

vi.mock("../redis", () => ({
  redis: { get: vi.fn(), set: vi.fn() },
  TEAM_ACTIVE_TTL_SECONDS: 100,
}));

vi.mock("../realtime", () => ({
  realtime: {
    channel: vi.fn(() => ({ emit: vi.fn(() => Promise.resolve()) })),
  },
}));

vi.mock("./helpers", () => ({
  getTeamRecord: vi.fn(),
  sanitizeTeam: vi.fn((t: unknown) => t),
}));

vi.mock("uuid", () => ({ v4: vi.fn(() => "test-uuid") }));

import { prisma } from "@repo/db";

import { realtime } from "../realtime";
import { redis } from "../redis";

import { getTeamRecord } from "./helpers";
import {
  addMember,
  importMembers,
  removeMember,
  reorderMembers,
  updateMember,
  updateOwnMember,
  updateTeamName,
} from "./member-actions";

const mockedGetTeamRecord = vi.mocked(getTeamRecord);
const mockedRequireTeamAdmin = vi.mocked(requireTeamAdmin);
const mockedRequireAuth = vi.mocked(requireAuth);
const mockedRedisSet = vi.mocked(redis.set);
const mockedChannel = vi.mocked(realtime.channel);
const mockedFindUnique = vi.mocked(prisma.membership.findUnique);

const mockEmit = vi.fn(() => Promise.resolve());

const validMemberInput = {
  name: "Alice",
  title: "Engineer",
  timezone: "America/New_York",
  workingHoursStart: 9,
  workingHoursEnd: 17,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedChannel.mockReturnValue({ emit: mockEmit } as never);
  mockedRequireTeamAdmin.mockResolvedValue(undefined as never);
});

describe("addMember", () => {
  it("returns error when auth fails", async () => {
    mockedRequireTeamAdmin.mockRejectedValue(new Error("Unauthorized"));

    const result = await addMember(VALID_UUID, validMemberInput as never);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to add member");
  });

  it("returns error when team not found", async () => {
    mockedGetTeamRecord.mockResolvedValue(null);

    const result = await addMember(VALID_UUID, validMemberInput as never);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Team not found");
  });

  it("assigns order equal to team.members.length", async () => {
    const existingMember = createTestMember({ id: VALID_UUID_2, order: 0 });
    const team = createTestTeamRecord({ members: [existingMember] });
    mockedGetTeamRecord.mockResolvedValue(team);

    const result = await addMember(VALID_UUID, validMemberInput as never);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.member.order).toBe(1);
      expect(result.data.member.id).toBe("test-uuid");
    }
  });

  it("pushes member to team and calls redis.set + realtime.emit", async () => {
    const team = createTestTeamRecord({ members: [] });
    mockedGetTeamRecord.mockResolvedValue(team);

    await addMember(VALID_UUID, validMemberInput as never);

    expect(mockedRedisSet).toHaveBeenCalledWith(`team:${VALID_UUID}`, expect.any(String), {
      ex: 100,
    });
    expect(mockEmit).toHaveBeenCalledWith(
      "team.memberAdded",
      expect.objectContaining({ name: "Alice" }),
    );
  });
});

describe("removeMember", () => {
  it("returns error when team not found", async () => {
    mockedGetTeamRecord.mockResolvedValue(null);

    const result = await removeMember(VALID_UUID, VALID_UUID_2);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Team not found");
  });

  it("returns error when member not found", async () => {
    const team = createTestTeamRecord({ members: [createTestMember()] });
    mockedGetTeamRecord.mockResolvedValue(team);

    const result = await removeMember(VALID_UUID, VALID_UUID_2);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Member not found");
  });

  it("filters out member and emits memberRemoved", async () => {
    const member = createTestMember({ id: VALID_UUID_2 });
    const team = createTestTeamRecord({ members: [member] });
    mockedGetTeamRecord.mockResolvedValue(team);

    const result = await removeMember(VALID_UUID, VALID_UUID_2);

    expect(result.success).toBe(true);
    expect(mockEmit).toHaveBeenCalledWith("team.memberRemoved", {
      memberId: VALID_UUID_2,
    });
  });
});

describe("updateMember", () => {
  it("returns error when member not found", async () => {
    const team = createTestTeamRecord({ members: [] });
    mockedGetTeamRecord.mockResolvedValue(team);

    const result = await updateMember(VALID_UUID, VALID_UUID_2, {
      name: "Bob",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Member not found");
  });

  it("updates member at correct index", async () => {
    const member1 = createTestMember({ id: VALID_UUID_2, name: "Alice" });
    const member2 = createTestMember({ id: VALID_UUID_3, name: "Bob" });
    const team = createTestTeamRecord({ members: [member1, member2] });
    mockedGetTeamRecord.mockResolvedValue(team);

    await updateMember(VALID_UUID, VALID_UUID_3, { name: "Charlie" });

    const savedTeam = JSON.parse(mockedRedisSet.mock.calls[0][1] as string);
    expect(savedTeam.members[0].name).toBe("Alice");
    expect(savedTeam.members[1].name).toBe("Charlie");
  });
});

describe("updateTeamName", () => {
  it("trims and slices name", async () => {
    const team = createTestTeamRecord();
    mockedGetTeamRecord.mockResolvedValue(team);

    await updateTeamName(VALID_UUID, "  My Team  ");

    const savedTeam = JSON.parse(mockedRedisSet.mock.calls[0][1] as string);
    expect(savedTeam.name).toBe("My Team");
  });

  it("rejects empty name after trimming", async () => {
    const result = await updateTeamName(VALID_UUID, "   ");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Team name cannot be empty");
  });

  it("truncates name to 100 characters", async () => {
    const team = createTestTeamRecord();
    mockedGetTeamRecord.mockResolvedValue(team);
    const longName = "A".repeat(150);

    await updateTeamName(VALID_UUID, longName);

    const savedTeam = JSON.parse(mockedRedisSet.mock.calls[0][1] as string);
    expect(savedTeam.name.length).toBe(100);
  });
});

describe("importMembers", () => {
  it("rejects empty array", async () => {
    const result = await importMembers(VALID_UUID, []);

    expect(result.success).toBe(false);
    expect(result.error).toBe("No members to import");
  });

  it("rejects more than 100 members", async () => {
    const members = Array.from({ length: 101 }, (_, i) => ({
      ...validMemberInput,
      name: `Member ${i}`,
    }));

    const result = await importMembers(VALID_UUID, members as never);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Cannot import more than 100 members at once");
  });

  it("assigns orders starting from existing member count", async () => {
    const existing = createTestMember({ id: VALID_UUID_2, order: 0 });
    const team = createTestTeamRecord({ members: [existing] });
    mockedGetTeamRecord.mockResolvedValue(team);

    const result = await importMembers(VALID_UUID, [
      validMemberInput as never,
      { ...validMemberInput, name: "Bob" } as never,
    ]);

    expect(result.success).toBe(true);
    const savedTeam = JSON.parse(mockedRedisSet.mock.calls[0][1] as string);
    // Existing member at index 0, imported start at order 1
    expect(savedTeam.members[1].order).toBe(1);
    expect(savedTeam.members[2].order).toBe(2);
  });

  it("returns error when team not found", async () => {
    mockedGetTeamRecord.mockResolvedValue(null);

    const result = await importMembers(VALID_UUID, [validMemberInput as never]);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Team not found");
  });
});

describe("updateOwnMember", () => {
  const session = createMockSession();

  beforeEach(() => {
    mockedRequireAuth.mockResolvedValue(session as never);
    mockedFindUnique.mockResolvedValue({ id: "membership-1" } as never);
  });

  it("uses requireAuth instead of requireTeamAdmin", async () => {
    const team = createTestTeamRecord({
      members: [createTestMember({ id: VALID_UUID_2, userId: "user-123" })],
    });
    mockedGetTeamRecord.mockResolvedValue(team);

    await updateOwnMember(VALID_UUID, VALID_UUID_2, { name: "Updated" });

    expect(mockedRequireAuth).toHaveBeenCalled();
    expect(mockedRequireTeamAdmin).not.toHaveBeenCalled();
  });

  it("returns error when user is not a team member (no membership)", async () => {
    mockedFindUnique.mockResolvedValue(null);

    const result = await updateOwnMember(VALID_UUID, VALID_UUID_2, {
      name: "X",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("You are not a member of this team");
  });

  it("returns error when member not found in team record", async () => {
    const team = createTestTeamRecord({ members: [] });
    mockedGetTeamRecord.mockResolvedValue(team);

    const result = await updateOwnMember(VALID_UUID, VALID_UUID_2, {
      name: "X",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Member not found");
  });

  it("rejects editing another user's member record", async () => {
    const team = createTestTeamRecord({
      members: [createTestMember({ id: VALID_UUID_2, userId: "other-user-id" })],
    });
    mockedGetTeamRecord.mockResolvedValue(team);

    const result = await updateOwnMember(VALID_UUID, VALID_UUID_2, {
      name: "Hacked",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("You can only edit your own member record");
  });

  it("allows editing own member record (userId matches)", async () => {
    const team = createTestTeamRecord({
      members: [createTestMember({ id: VALID_UUID_2, userId: "user-123" })],
    });
    mockedGetTeamRecord.mockResolvedValue(team);

    const result = await updateOwnMember(VALID_UUID, VALID_UUID_2, {
      name: "New Name",
    });

    expect(result.success).toBe(true);
    const savedTeam = JSON.parse(mockedRedisSet.mock.calls[0][1] as string);
    expect(savedTeam.members[0].name).toBe("New Name");
  });

  it("claims unclaimed record by setting userId", async () => {
    const team = createTestTeamRecord({
      members: [createTestMember({ id: VALID_UUID_2, userId: undefined })],
    });
    mockedGetTeamRecord.mockResolvedValue(team);

    const result = await updateOwnMember(VALID_UUID, VALID_UUID_2, {
      name: "Claimed",
    });

    expect(result.success).toBe(true);
    const savedTeam = JSON.parse(mockedRedisSet.mock.calls[0][1] as string);
    expect(savedTeam.members[0].userId).toBe("user-123");
  });

  it("strips groupId from updates to prevent self-assignment", async () => {
    const team = createTestTeamRecord({
      members: [
        createTestMember({
          id: VALID_UUID_2,
          userId: "user-123",
          groupId: undefined,
        }),
      ],
    });
    mockedGetTeamRecord.mockResolvedValue(team);

    await updateOwnMember(VALID_UUID, VALID_UUID_2, {
      name: "Updated",
      groupId: VALID_UUID_3,
    } as never);

    const savedTeam = JSON.parse(mockedRedisSet.mock.calls[0][1] as string);
    expect(savedTeam.members[0].groupId).toBeUndefined();
  });

  it("propagates auth error", async () => {
    mockedRequireAuth.mockRejectedValue(new Error("Not authenticated"));

    const result = await updateOwnMember(VALID_UUID, VALID_UUID_2, {
      name: "X",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to update member");
  });
});

describe("reorderMembers", () => {
  it("returns error when team not found", async () => {
    mockedGetTeamRecord.mockResolvedValue(null);

    const result = await reorderMembers(VALID_UUID, [VALID_UUID_2]);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Team not found");
  });

  it("rejects when member IDs do not match existing members", async () => {
    const team = createTestTeamRecord({
      members: [createTestMember({ id: VALID_UUID_2 }), createTestMember({ id: VALID_UUID_3 })],
    });
    mockedGetTeamRecord.mockResolvedValue(team);

    const result = await reorderMembers(VALID_UUID, [VALID_UUID_2, "nonexistent-id"]);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid member order");
  });

  it("rejects when member count does not match", async () => {
    const team = createTestTeamRecord({
      members: [createTestMember({ id: VALID_UUID_2 }), createTestMember({ id: VALID_UUID_3 })],
    });
    mockedGetTeamRecord.mockResolvedValue(team);

    const result = await reorderMembers(VALID_UUID, [VALID_UUID_2]);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid member order");
  });

  it("updates order values based on new positions", async () => {
    const member1 = createTestMember({ id: VALID_UUID_2, name: "A", order: 0 });
    const member2 = createTestMember({ id: VALID_UUID_3, name: "B", order: 1 });
    const team = createTestTeamRecord({ members: [member1, member2] });
    mockedGetTeamRecord.mockResolvedValue(team);

    const result = await reorderMembers(VALID_UUID, [VALID_UUID_3, VALID_UUID_2]);

    expect(result.success).toBe(true);
    const savedTeam = JSON.parse(mockedRedisSet.mock.calls[0][1] as string);
    expect(savedTeam.members[0].id).toBe(VALID_UUID_3);
    expect(savedTeam.members[0].order).toBe(0);
    expect(savedTeam.members[1].id).toBe(VALID_UUID_2);
    expect(savedTeam.members[1].order).toBe(1);
  });

  it("emits membersReordered event", async () => {
    const team = createTestTeamRecord({
      members: [createTestMember({ id: VALID_UUID_2 }), createTestMember({ id: VALID_UUID_3 })],
    });
    mockedGetTeamRecord.mockResolvedValue(team);

    await reorderMembers(VALID_UUID, [VALID_UUID_3, VALID_UUID_2]);

    expect(mockEmit).toHaveBeenCalledWith("team.membersReordered", {
      order: [VALID_UUID_3, VALID_UUID_2],
    });
  });
});
