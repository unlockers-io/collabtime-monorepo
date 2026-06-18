import { db, membership, space, user } from "@repo/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
  requireAuth: vi.fn(),
  requireTeamAdmin: vi.fn(),
}));

vi.mock("../redis", () => ({
  redis: { get: vi.fn(), set: vi.fn() },
  TEAM_ACTIVE_TTL_SECONDS: 100,
}));

vi.mock("uuid", () => ({ v4: vi.fn(() => "test-uuid") }));

import { redis } from "../redis";

import {
  addMember,
  importMembers,
  removeMember,
  reorderMembers,
  updateMember,
  updateOwnMember,
  updateTeamName,
} from "./member-actions";

// updateOwnMember reads a real Membership row; seed against the live DB.
const OWN_USER_ID = "user-123";
const OWN_SPACE_ID = "member-actions-space";
// Tests below call updateOwnMember(VALID_UUID, ...), so the Membership FK target
// (Space.teamId) must be VALID_UUID. This file owns VALID_UUID's Space row.
const OWN_TEAM_ID = VALID_UUID;

const now = () => new Date().toISOString();

const setOwnMembership = async (exists: boolean) => {
  await db.delete(membership).where(eq(membership.userId, OWN_USER_ID));
  if (exists) {
    await db.insert(membership).values({
      id: "member-actions-membership",
      role: "MEMBER",
      teamId: OWN_TEAM_ID,
      updatedAt: now(),
      userId: OWN_USER_ID,
    });
  }
};

beforeAll(async () => {
  await db.delete(membership).where(eq(membership.userId, OWN_USER_ID));
  await db.delete(space).where(eq(space.id, OWN_SPACE_ID));
  await db.delete(user).where(eq(user.id, OWN_USER_ID));
  await db.insert(user).values({
    email: "member-actions-user@example.com",
    emailVerified: true,
    id: OWN_USER_ID,
    name: "Test User",
    updatedAt: now(),
  });
  await db.insert(space).values({
    id: OWN_SPACE_ID,
    ownerId: OWN_USER_ID,
    teamId: OWN_TEAM_ID,
    updatedAt: now(),
  });
});

afterAll(async () => {
  await db.delete(membership).where(eq(membership.userId, OWN_USER_ID));
  await db.delete(space).where(eq(space.id, OWN_SPACE_ID));
  await db.delete(user).where(eq(user.id, OWN_USER_ID));
});

const mockedRequireTeamAdmin = vi.mocked(requireTeamAdmin);
const mockedRequireAuth = vi.mocked(requireAuth);
const mockedRedisGet = vi.mocked(redis.get);
const mockedRedisSet = vi.mocked(redis.set);

const seedTeam = (team: ReturnType<typeof createTestTeamRecord>) => {
  mockedRedisGet.mockResolvedValue(JSON.stringify(team));
};

const persistedTeam = () => {
  const lastCall = mockedRedisSet.mock.calls.at(-1);
  if (!lastCall) {
    throw new Error("redis.set was not called");
  }
  return JSON.parse(lastCall[1] as string) as ReturnType<typeof createTestTeamRecord>;
};

const validMemberInput = {
  name: "Alice",
  timezone: "America/New_York",
  title: "Engineer",
  workingHoursEnd: 17,
  workingHoursStart: 9,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedRequireTeamAdmin.mockResolvedValue(undefined as never);
  mockedRedisSet.mockResolvedValue("OK" as never);
});

describe("addMember", () => {
  it("returns error when auth fails", async () => {
    mockedRequireTeamAdmin.mockRejectedValue(new Error("Unauthorized"));

    const result = await addMember(VALID_UUID, validMemberInput as never);

    expect(result).toEqual({ error: "Failed to add member", success: false });
  });

  it("returns error when team not found", async () => {
    mockedRedisGet.mockResolvedValue(null);

    const result = await addMember(VALID_UUID, validMemberInput as never);

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("assigns order equal to team.members.length", async () => {
    const existingMember = createTestMember({ id: VALID_UUID_2, order: 0 });
    seedTeam(createTestTeamRecord({ members: [existingMember] }));

    const result = await addMember(VALID_UUID, validMemberInput as never);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.member.order).toBe(1);
      expect(result.data.member.id).toBe("test-uuid");
    }
  });

  it("pushes member to team and persists", async () => {
    seedTeam(createTestTeamRecord({ members: [] }));

    await addMember(VALID_UUID, validMemberInput as never);

    expect(persistedTeam().members).toHaveLength(1);
  });
});

describe("removeMember", () => {
  it("returns error when memberId is not a UUID", async () => {
    const result = await removeMember(VALID_UUID, "not-a-uuid");

    expect(result).toEqual({ error: "Invalid member ID", success: false });
  });

  it("returns error when team not found", async () => {
    mockedRedisGet.mockResolvedValue(null);

    const result = await removeMember(VALID_UUID, VALID_UUID_2);

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("returns error when member not found", async () => {
    seedTeam(createTestTeamRecord({ members: [createTestMember()] }));

    const result = await removeMember(VALID_UUID, VALID_UUID_2);

    expect(result).toEqual({ error: "Member not found", success: false });
  });

  it("filters out member and persists", async () => {
    const member = createTestMember({ id: VALID_UUID_2 });
    seedTeam(createTestTeamRecord({ members: [member] }));

    const result = await removeMember(VALID_UUID, VALID_UUID_2);

    expect(result.success).toBe(true);
    expect(persistedTeam().members).toHaveLength(0);
  });
});

describe("updateMember", () => {
  it("returns error when member not found", async () => {
    seedTeam(createTestTeamRecord({ members: [] }));

    const result = await updateMember(VALID_UUID, VALID_UUID_2, {
      name: "Bob",
    });

    expect(result).toEqual({ error: "Member not found", success: false });
  });

  it("updates member at correct index", async () => {
    const member1 = createTestMember({ id: VALID_UUID_2, name: "Alice" });
    const member2 = createTestMember({ id: VALID_UUID_3, name: "Bob" });
    seedTeam(createTestTeamRecord({ members: [member1, member2] }));

    await updateMember(VALID_UUID, VALID_UUID_3, { name: "Charlie" });

    const saved = persistedTeam();
    expect(saved.members[0].name).toBe("Alice");
    expect(saved.members[1].name).toBe("Charlie");
  });
});

describe("updateTeamName", () => {
  it("trims and slices name", async () => {
    seedTeam(createTestTeamRecord());

    await updateTeamName(VALID_UUID, "  My Team  ");

    expect(persistedTeam().name).toBe("My Team");
  });

  it("rejects empty name after trimming", async () => {
    const result = await updateTeamName(VALID_UUID, "   ");

    expect(result).toEqual({ error: "Team name cannot be empty", success: false });
  });

  it("truncates name to 100 characters", async () => {
    seedTeam(createTestTeamRecord());
    const longName = "A".repeat(150);

    await updateTeamName(VALID_UUID, longName);

    expect(persistedTeam().name.length).toBe(100);
  });
});

describe("importMembers", () => {
  it("rejects empty array", async () => {
    const result = await importMembers(VALID_UUID, []);

    expect(result).toEqual({ error: "No members to import", success: false });
  });

  it("rejects more than 100 members", async () => {
    const members = Array.from({ length: 101 }, (_, i) => ({
      ...validMemberInput,
      name: `Member ${i}`,
    }));

    const result = await importMembers(VALID_UUID, members as never);

    expect(result).toEqual({
      error: "Cannot import more than 100 members at once",
      success: false,
    });
  });

  it("assigns orders starting from existing member count", async () => {
    const existing = createTestMember({ id: VALID_UUID_2, order: 0 });
    seedTeam(createTestTeamRecord({ members: [existing] }));

    const result = await importMembers(VALID_UUID, [
      validMemberInput as never,
      { ...validMemberInput, name: "Bob" } as never,
    ]);

    expect(result.success).toBe(true);
    const saved = persistedTeam();
    // Existing member at index 0, imported start at order 1
    expect(saved.members[1].order).toBe(1);
    expect(saved.members[2].order).toBe(2);
  });

  it("returns error when team not found", async () => {
    mockedRedisGet.mockResolvedValue(null);

    const result = await importMembers(VALID_UUID, [validMemberInput as never]);

    expect(result).toEqual({ error: "Team not found", success: false });
  });
});

describe("updateOwnMember", () => {
  const session = createMockSession();

  beforeEach(async () => {
    mockedRequireAuth.mockResolvedValue(session as never);
    await setOwnMembership(true);
  });

  it("uses requireAuth instead of requireTeamAdmin", async () => {
    seedTeam(
      createTestTeamRecord({
        members: [createTestMember({ id: VALID_UUID_2, userId: "user-123" })],
      }),
    );

    await updateOwnMember(VALID_UUID, VALID_UUID_2, { name: "Updated" });

    expect(mockedRequireAuth).toHaveBeenCalled();
    expect(mockedRequireTeamAdmin).not.toHaveBeenCalled();
  });

  it("returns error when user is not a team member (no membership)", async () => {
    await setOwnMembership(false);

    const result = await updateOwnMember(VALID_UUID, VALID_UUID_2, {
      name: "X",
    });

    expect(result).toEqual({ error: "You are not a member of this team", success: false });
  });

  it("returns error when member not found in team record", async () => {
    seedTeam(createTestTeamRecord({ members: [] }));

    const result = await updateOwnMember(VALID_UUID, VALID_UUID_2, {
      name: "X",
    });

    expect(result).toEqual({ error: "Member not found", success: false });
  });

  it("rejects editing another user's member record", async () => {
    seedTeam(
      createTestTeamRecord({
        members: [createTestMember({ id: VALID_UUID_2, userId: "other-user-id" })],
      }),
    );

    const result = await updateOwnMember(VALID_UUID, VALID_UUID_2, {
      name: "Hacked",
    });

    expect(result).toEqual({
      error: "You can only edit your own member record",
      success: false,
    });
  });

  it("allows editing own member record (userId matches)", async () => {
    seedTeam(
      createTestTeamRecord({
        members: [createTestMember({ id: VALID_UUID_2, userId: "user-123" })],
      }),
    );

    const result = await updateOwnMember(VALID_UUID, VALID_UUID_2, {
      name: "New Name",
    });

    expect(result.success).toBe(true);
    expect(persistedTeam().members[0].name).toBe("New Name");
  });

  it("claims unclaimed record by setting userId", async () => {
    seedTeam(
      createTestTeamRecord({
        members: [createTestMember({ id: VALID_UUID_2, userId: undefined })],
      }),
    );

    const result = await updateOwnMember(VALID_UUID, VALID_UUID_2, {
      name: "Claimed",
    });

    expect(result.success).toBe(true);
    expect(persistedTeam().members[0].userId).toBe("user-123");
  });

  it("strips groupId from updates to prevent self-assignment", async () => {
    seedTeam(
      createTestTeamRecord({
        members: [
          createTestMember({
            groupId: undefined,
            id: VALID_UUID_2,
            userId: "user-123",
          }),
        ],
      }),
    );

    await updateOwnMember(VALID_UUID, VALID_UUID_2, {
      groupId: VALID_UUID_3,
      name: "Updated",
    } as never);

    expect(persistedTeam().members[0].groupId).toBeUndefined();
  });

  it("propagates auth error", async () => {
    mockedRequireAuth.mockRejectedValue(new Error("Not authenticated"));

    const result = await updateOwnMember(VALID_UUID, VALID_UUID_2, {
      name: "X",
    });

    expect(result).toEqual({ error: "Failed to update member", success: false });
  });
});

describe("reorderMembers", () => {
  it("returns error when team not found", async () => {
    mockedRedisGet.mockResolvedValue(null);

    const result = await reorderMembers(VALID_UUID, [VALID_UUID_2]);

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("rejects when member IDs do not match existing members", async () => {
    seedTeam(
      createTestTeamRecord({
        members: [createTestMember({ id: VALID_UUID_2 }), createTestMember({ id: VALID_UUID_3 })],
      }),
    );

    const result = await reorderMembers(VALID_UUID, [VALID_UUID_2, "nonexistent-id"]);

    expect(result).toEqual({ error: "Invalid member order", success: false });
  });

  it("rejects when member count does not match", async () => {
    seedTeam(
      createTestTeamRecord({
        members: [createTestMember({ id: VALID_UUID_2 }), createTestMember({ id: VALID_UUID_3 })],
      }),
    );

    const result = await reorderMembers(VALID_UUID, [VALID_UUID_2]);

    expect(result).toEqual({ error: "Invalid member order", success: false });
  });

  it("updates order values based on new positions", async () => {
    const member1 = createTestMember({ id: VALID_UUID_2, name: "A", order: 0 });
    const member2 = createTestMember({ id: VALID_UUID_3, name: "B", order: 1 });
    seedTeam(createTestTeamRecord({ members: [member1, member2] }));

    const result = await reorderMembers(VALID_UUID, [VALID_UUID_3, VALID_UUID_2]);

    expect(result.success).toBe(true);
    const saved = persistedTeam();
    expect(saved.members[0].id).toBe(VALID_UUID_3);
    expect(saved.members[0].order).toBe(0);
    expect(saved.members[1].id).toBe(VALID_UUID_2);
    expect(saved.members[1].order).toBe(1);
  });

  it("persists reordered members", async () => {
    seedTeam(
      createTestTeamRecord({
        members: [createTestMember({ id: VALID_UUID_2 }), createTestMember({ id: VALID_UUID_3 })],
      }),
    );

    await reorderMembers(VALID_UUID, [VALID_UUID_3, VALID_UUID_2]);

    const saved = persistedTeam();
    expect(saved.members[0].id).toBe(VALID_UUID_3);
    expect(saved.members[1].id).toBe(VALID_UUID_2);
  });
});
