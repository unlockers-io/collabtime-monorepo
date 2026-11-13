// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamChangeArgs } from "../team-changes";
import { postgresTeamStorage } from "../team-storage";
import { createTeamStore } from "../team-store";

import { createTeamChangeAction } from "./team-change-core";
import {
  createTestGroup,
  createTestGuards,
  createTestMember,
  createTestTeamRecord,
  createTestTeamStore,
  VALID_UUID,
  VALID_UUID_2,
  VALID_UUID_3,
} from "./test-helpers";

type TeamChangeDeps = Parameters<typeof createTeamChangeAction>[0];

const harness = createTestTeamStore();
const guards = createTestGuards();
const reportError = vi.fn<TeamChangeDeps["reportError"]>();

const changeTeam = createTeamChangeAction({
  applyTeamCommand: harness.applyTeamCommand,
  authorizeTeamAdmin: guards.authorizeTeamAdmin,
  authorizeTeamMember: guards.authorizeTeamMember,
  reportError,
  revokeMemberAccess: harness.revokeMemberAccess,
});

const { seedTeam } = harness;

const persistedTeam = async () => {
  const team = await harness.readTeam();

  if (!team) {
    throw new Error("team was not persisted");
  }

  return team;
};

const validMemberInput: TeamChangeArgs<"addMember"> = {
  name: "Alice",
  timezone: "America/New_York",
  title: "Engineer",
  workingHoursEnd: 17,
  workingHoursStart: 9,
};

beforeEach(async () => {
  await harness.reset();
  guards.reset();
  reportError.mockReset();
});

describe("authorization", () => {
  it.each([
    ["addMember", () => changeTeam(VALID_UUID, "addMember", { ...validMemberInput, name: "" })],
    ["removeMember", () => changeTeam(VALID_UUID, "removeMember", { memberId: VALID_UUID_2 })],
    [
      "updateMember",
      () =>
        changeTeam(VALID_UUID, "updateMember", { memberId: VALID_UUID_2, updates: { name: "" } }),
    ],
    ["updateTeamName", () => changeTeam(VALID_UUID, "renameTeam", { name: "" })],
    ["importMembers", () => changeTeam(VALID_UUID, "importMembers", { members: [] })],
    ["reorderMembers", () => changeTeam(VALID_UUID, "reorderMembers", { memberIds: [] })],
  ])("%s refuses a non-admin before validating input or cleanup", async (_name, run) => {
    const team = createTestTeamRecord({
      members: [createTestMember({ id: VALID_UUID_2, userId: "other" })],
    });

    await seedTeam(team);
    await harness.seedMembership("other");
    await harness.seedInvitation(VALID_UUID_2);
    guards.authorizeTeamAdmin.mockResolvedValue({ error: "Admin access required", success: false });

    expect(await run()).toEqual({ error: "Admin access required", success: false });
    expect(guards.authorizeTeamAdmin).toHaveBeenCalledWith(VALID_UUID);
    expect(await harness.findMembership("other")).not.toBeNull();
    expect(await harness.invitationStatus(VALID_UUID_2)).toBe("PENDING");
    expect(harness.invalidateTeamName).not.toHaveBeenCalled();
    expect(await harness.readTeam()).toEqual(team);
  });

  it.each([
    [
      "updateOwnMember",
      () =>
        changeTeam(VALID_UUID, "updateOwnMember", {
          memberId: VALID_UUID_2,
          updates: { name: "" },
        }),
    ],
    ["createOwnMemberSlot", () => changeTeam(VALID_UUID, "claimOwnSlot", {})],
  ])("%s refuses a non-member before touching the team", async (_name, run) => {
    const team = createTestTeamRecord({ members: [createTestMember({ id: VALID_UUID_2 })] });
    await seedTeam(team);
    guards.authorizeTeamMember.mockResolvedValue({
      error: "You are not a member of this team",
      success: false,
    });

    expect(await run()).toEqual({ error: "You are not a member of this team", success: false });
    expect(guards.authorizeTeamMember).toHaveBeenCalledWith(VALID_UUID);
    expect(await harness.readTeam()).toEqual(team);
  });
});

describe("addMember", () => {
  it("returns error when team not found", async () => {
    const result = await changeTeam(VALID_UUID, "addMember", validMemberInput);

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("assigns order equal to team.members.length", async () => {
    const existingMember = createTestMember({ id: VALID_UUID_2, order: 0 });
    await seedTeam(createTestTeamRecord({ members: [existingMember] }));

    expect(await changeTeam(VALID_UUID, "addMember", validMemberInput)).toEqual({
      data: { memberId: "test-uuid" },
      success: true,
    });
    const persisted = await persistedTeam();
    expect(persisted.members[1]).toMatchObject({ id: "test-uuid", order: 1 });
  });

  it("pushes member to team and persists", async () => {
    await seedTeam(createTestTeamRecord({ members: [] }));

    await changeTeam(VALID_UUID, "addMember", validMemberInput);

    const persisted = await persistedTeam();
    expect(persisted.members).toHaveLength(1);
  });
});

describe("removeMember", () => {
  it("returns error when memberId is not a UUID", async () => {
    const result = await changeTeam(VALID_UUID, "removeMember", { memberId: "not-a-uuid" });

    expect(result).toEqual({ error: "Invalid member ID", success: false });
  });

  it("returns error when team not found", async () => {
    const result = await changeTeam(VALID_UUID, "removeMember", { memberId: VALID_UUID_2 });

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("returns error when member not found", async () => {
    await seedTeam(createTestTeamRecord({ members: [createTestMember()] }));

    const result = await changeTeam(VALID_UUID, "removeMember", { memberId: VALID_UUID_2 });

    expect(result).toEqual({ error: "Member not found", success: false });
  });

  it("filters out member and persists", async () => {
    const member = createTestMember({ id: VALID_UUID_2 });
    await seedTeam(createTestTeamRecord({ members: [member] }));

    const result = await changeTeam(VALID_UUID, "removeMember", { memberId: VALID_UUID_2 });

    expect(result.success).toBe(true);
    const persisted = await persistedTeam();
    expect(persisted.members).toHaveLength(0);
  });
});

describe("updateMember", () => {
  it("returns error when member not found", async () => {
    await seedTeam(createTestTeamRecord({ members: [] }));

    const result = await changeTeam(VALID_UUID, "updateMember", {
      memberId: VALID_UUID_2,
      updates: {
        name: "Bob",
      },
    });

    expect(result).toEqual({ error: "Member not found", success: false });
  });

  it("updates member at correct index", async () => {
    const member1 = createTestMember({ id: VALID_UUID_2, name: "Alice" });
    const member2 = createTestMember({ id: VALID_UUID_3, name: "Bob" });
    await seedTeam(createTestTeamRecord({ members: [member1, member2] }));

    await changeTeam(VALID_UUID, "updateMember", {
      memberId: VALID_UUID_3,
      updates: { name: "Charlie" },
    });

    const saved = await persistedTeam();
    expect(saved.members[0]?.name).toBe("Alice");
    expect(saved.members[1]?.name).toBe("Charlie");
  });
});

describe("updateTeamName", () => {
  it("trims name and revalidates the cached name", async () => {
    await seedTeam(createTestTeamRecord());

    await changeTeam(VALID_UUID, "renameTeam", { name: "  My Team  " });

    const persisted = await persistedTeam();
    expect(persisted.name).toBe("My Team");
    expect(harness.invalidateTeamName).toHaveBeenCalledExactlyOnceWith(VALID_UUID);
  });

  it("rejects empty name after trimming", async () => {
    const result = await changeTeam(VALID_UUID, "renameTeam", { name: "   " });

    expect(result).toEqual({ error: "Workspace name is required", success: false });
    expect(harness.invalidateTeamName).not.toHaveBeenCalled();
  });

  it("rejects names longer than 100 characters", async () => {
    await seedTeam(createTestTeamRecord());
    const longName = "A".repeat(150);

    const result = await changeTeam(VALID_UUID, "renameTeam", { name: longName });
    expect(result.success).toBe(false);
    const persisted = await persistedTeam();
    expect(persisted.name).toBe("Test Team");
  });
});

describe("importMembers", () => {
  it("rejects empty array", async () => {
    const result = await changeTeam(VALID_UUID, "importMembers", { members: [] });

    expect(result).toEqual({ error: "No members to import", success: false });
  });

  it("rejects more than 100 members", async () => {
    const members = Array.from({ length: 101 }, (_, i) => ({
      ...validMemberInput,
      name: `Member ${i}`,
    }));

    const result = await changeTeam(VALID_UUID, "importMembers", { members });

    expect(result).toEqual({
      error: "Cannot import more than 100 members at once",
      success: false,
    });
  });

  it("assigns orders starting from existing member count", async () => {
    const existing = createTestMember({ id: VALID_UUID_2, order: 0 });
    await seedTeam(createTestTeamRecord({ members: [existing] }));

    const result = await changeTeam(VALID_UUID, "importMembers", {
      members: [validMemberInput, { ...validMemberInput, name: "Bob" }],
    });

    expect(result.success).toBe(true);
    const saved = await persistedTeam();
    expect(saved.members[1]?.order).toBe(1);
    expect(saved.members[2]?.order).toBe(2);
  });

  it("returns error when team not found", async () => {
    const result = await changeTeam(VALID_UUID, "importMembers", { members: [validMemberInput] });

    expect(result).toEqual({ error: "Team not found", success: false });
  });
});

describe("updateOwnMember", () => {
  it("requires membership rather than admin access", async () => {
    await seedTeam(
      createTestTeamRecord({
        members: [createTestMember({ id: VALID_UUID_2, userId: "user-123" })],
      }),
    );

    await changeTeam(VALID_UUID, "updateOwnMember", {
      memberId: VALID_UUID_2,
      updates: { name: "Updated" },
    });

    expect(guards.authorizeTeamMember).toHaveBeenCalledWith(VALID_UUID);
    expect(guards.authorizeTeamAdmin).not.toHaveBeenCalled();
  });

  it("returns error when member not found in team record", async () => {
    await seedTeam(createTestTeamRecord({ members: [] }));

    const result = await changeTeam(VALID_UUID, "updateOwnMember", {
      memberId: VALID_UUID_2,
      updates: {
        name: "X",
      },
    });

    expect(result).toEqual({ error: "Member not found", success: false });
  });

  it("rejects editing another user's member record", async () => {
    await seedTeam(
      createTestTeamRecord({
        members: [createTestMember({ id: VALID_UUID_2, userId: "other-user-id" })],
      }),
    );

    const result = await changeTeam(VALID_UUID, "updateOwnMember", {
      memberId: VALID_UUID_2,
      updates: {
        name: "Hacked",
      },
    });

    expect(result).toEqual({
      error: "You can only edit your own member record",
      success: false,
    });
  });

  it("allows editing own member record (userId matches)", async () => {
    await seedTeam(
      createTestTeamRecord({
        members: [createTestMember({ id: VALID_UUID_2, userId: "user-123" })],
      }),
    );

    const result = await changeTeam(VALID_UUID, "updateOwnMember", {
      memberId: VALID_UUID_2,
      updates: {
        name: "New Name",
      },
    });

    expect(result.success).toBe(true);
    const persisted = await persistedTeam();
    expect(persisted.members[0]?.name).toBe("New Name");
  });

  it("refuses to claim a second record for a user who already has one", async () => {
    await seedTeam(
      createTestTeamRecord({
        members: [
          createTestMember({ id: VALID_UUID_2, userId: "user-123" }),
          createTestMember({ id: VALID_UUID_3 }),
        ],
      }),
    );

    expect(
      await changeTeam(VALID_UUID, "updateOwnMember", {
        memberId: VALID_UUID_3,
        updates: { name: "Claimed" },
      }),
    ).toEqual({
      error: "You already have a profile on this team",
      success: false,
    });
    const persisted = await persistedTeam();
    expect(persisted.members[1]?.userId).toBeUndefined();
  });

  it("claims unclaimed record by setting userId", async () => {
    await seedTeam(
      createTestTeamRecord({
        members: [createTestMember({ id: VALID_UUID_2, userId: undefined })],
      }),
    );

    const result = await changeTeam(VALID_UUID, "updateOwnMember", {
      memberId: VALID_UUID_2,
      updates: {
        name: "Claimed",
      },
    });

    expect(result.success).toBe(true);
    const persisted = await persistedTeam();
    expect(persisted.members[0]?.userId).toBe("user-123");
  });
});

describe("reorderMembers", () => {
  it("returns error when team not found", async () => {
    const result = await changeTeam(VALID_UUID, "reorderMembers", { memberIds: [VALID_UUID_2] });

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("rejects when member IDs do not match existing members", async () => {
    await seedTeam(
      createTestTeamRecord({
        members: [createTestMember({ id: VALID_UUID_2 }), createTestMember({ id: VALID_UUID_3 })],
      }),
    );

    const result = await changeTeam(VALID_UUID, "reorderMembers", {
      memberIds: [VALID_UUID_2, "nonexistent-id"],
    });

    expect(result).toEqual({ error: "Invalid member order", success: false });
  });

  it("rejects when member count does not match", async () => {
    await seedTeam(
      createTestTeamRecord({
        members: [createTestMember({ id: VALID_UUID_2 }), createTestMember({ id: VALID_UUID_3 })],
      }),
    );

    const result = await changeTeam(VALID_UUID, "reorderMembers", { memberIds: [VALID_UUID_2] });

    expect(result).toEqual({ error: "Invalid member order", success: false });
  });

  it("updates order values based on new positions", async () => {
    const member1 = createTestMember({ id: VALID_UUID_2, name: "A", order: 0 });
    const member2 = createTestMember({ id: VALID_UUID_3, name: "B", order: 1 });
    await seedTeam(createTestTeamRecord({ members: [member1, member2] }));

    const result = await changeTeam(VALID_UUID, "reorderMembers", {
      memberIds: [VALID_UUID_3, VALID_UUID_2],
    });

    expect(result.success).toBe(true);
    const saved = await persistedTeam();
    expect(saved.members[0]?.id).toBe(VALID_UUID_3);
    expect(saved.members[0]?.order).toBe(0);
    expect(saved.members[1]?.id).toBe(VALID_UUID_2);
    expect(saved.members[1]?.order).toBe(1);
  });

  it("persists reordered members", async () => {
    await seedTeam(
      createTestTeamRecord({
        members: [createTestMember({ id: VALID_UUID_2 }), createTestMember({ id: VALID_UUID_3 })],
      }),
    );

    await changeTeam(VALID_UUID, "reorderMembers", { memberIds: [VALID_UUID_3, VALID_UUID_2] });

    const saved = await persistedTeam();
    expect(saved.members[0]?.id).toBe(VALID_UUID_3);
    expect(saved.members[1]?.id).toBe(VALID_UUID_2);
  });
});

describe("member limits", () => {
  it("allows the 200th member and rejects the next", async () => {
    await seedTeam(
      createTestTeamRecord({
        members: Array.from({ length: 199 }, (_, index) =>
          createTestMember({ id: `member-${index}` }),
        ),
      }),
    );
    const result1 = await changeTeam(VALID_UUID, "addMember", validMemberInput);
    expect(result1.success).toBe(true);
    const result2 = await changeTeam(VALID_UUID, "addMember", validMemberInput);
    expect(result2.success).toBe(false);
    const persisted = await persistedTeam();
    expect(persisted.members).toHaveLength(200);
  });

  it("rejects an oversized total import without partial writes", async () => {
    await seedTeam(
      createTestTeamRecord({
        members: Array.from({ length: 199 }, (_, index) =>
          createTestMember({ id: `member-${index}` }),
        ),
      }),
    );
    expect(
      await changeTeam(VALID_UUID, "importMembers", {
        members: [validMemberInput, validMemberInput],
      }),
    ).toEqual({
      error: "A workspace can have up to 200 members",
      success: false,
    });
    const refused = await persistedTeam();
    expect(refused.members).toHaveLength(199);
    const result3 = await changeTeam(VALID_UUID, "importMembers", { members: [validMemberInput] });
    expect(result3.success).toBe(true);
    const filled = await persistedTeam();
    expect(filled.members).toHaveLength(200);
  });
});

describe("removal cleanup", () => {
  it("revokes the removed member's access and pending invitations", async () => {
    await seedTeam(
      createTestTeamRecord({ members: [createTestMember({ id: VALID_UUID_2, userId: "other" })] }),
    );
    await harness.seedMembership("other");
    await harness.seedInvitation(VALID_UUID_2);

    expect(await changeTeam(VALID_UUID, "removeMember", { memberId: VALID_UUID_2 })).toEqual({
      data: undefined,
      success: true,
    });
    const persisted = await persistedTeam();
    expect(persisted.members).toEqual([]);
    expect(await harness.findMembership("other")).toBeNull();
    expect(await harness.invitationStatus(VALID_UUID_2)).toBe("REVOKED");
  });

  it("keeps the slot to remove again when revoking access fails", async () => {
    const member = createTestMember({ id: VALID_UUID_2, userId: "other" });
    await seedTeam(createTestTeamRecord({ members: [member] }));
    harness.membershipStore.revoke.mockRejectedValueOnce(new Error("Database unavailable"));

    expect(await changeTeam(VALID_UUID, "removeMember", { memberId: VALID_UUID_2 })).toEqual({
      error: "Failed to remove member",
      success: false,
    });
    const persisted = await persistedTeam();
    expect(persisted.members).toEqual([member]);
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ message: "Failed to remove member", teamId: VALID_UUID }),
    );

    expect(await changeTeam(VALID_UUID, "removeMember", { memberId: VALID_UUID_2 })).toMatchObject({
      success: true,
    });
  });

  it("leaves access untouched when the removal is rejected", async () => {
    await seedTeam(createTestTeamRecord({ members: [createTestMember()] }));

    expect(await changeTeam(VALID_UUID, "removeMember", { memberId: VALID_UUID_2 })).toEqual({
      error: "Member not found",
      success: false,
    });
    expect(harness.membershipStore.revoke).not.toHaveBeenCalled();
  });

  it("does not delete the caller membership", async () => {
    await seedTeam(
      createTestTeamRecord({
        members: [createTestMember({ id: VALID_UUID_2, userId: "user-123" })],
      }),
    );
    await harness.seedMembership("user-123");

    expect(await changeTeam(VALID_UUID, "removeMember", { memberId: VALID_UUID_2 })).toMatchObject({
      success: true,
    });
    expect(await harness.findMembership("user-123")).not.toBeNull();
  });
});

describe("createOwnMemberSlot", () => {
  it("returns an existing profile without creating another", async () => {
    await seedTeam(
      createTestTeamRecord({
        members: [createTestMember({ id: VALID_UUID_2, userId: "user-123" })],
      }),
    );

    expect(await changeTeam(VALID_UUID, "claimOwnSlot", {})).toEqual({
      data: { created: false, memberId: VALID_UUID_2 },
      success: true,
    });
    const persisted = await persistedTeam();
    expect(persisted.members).toHaveLength(1);
  });

  it("creates a profile owned by the caller", async () => {
    await seedTeam(createTestTeamRecord());

    expect(await changeTeam(VALID_UUID, "claimOwnSlot", {})).toEqual({
      data: { created: true, memberId: "test-uuid" },
      success: true,
    });
    const persisted = await persistedTeam();
    expect(persisted.members[0]).toMatchObject({
      name: "Test User",
      userId: "user-123",
    });
  });
});

describe("group authorization", () => {
  it.each([
    ["createGroup", () => changeTeam(VALID_UUID, "addGroup", { name: "" })],
    [
      "updateGroup",
      () => changeTeam(VALID_UUID, "updateGroup", { groupId: "not-a-uuid", name: "" }),
    ],
    ["removeGroup", () => changeTeam(VALID_UUID, "removeGroup", { groupId: "not-a-uuid" })],
    ["reorderGroups", () => changeTeam(VALID_UUID, "reorderGroups", { groupIds: [] })],
  ])("%s refuses a non-admin before validating input", async (_name, run) => {
    const team = createTestTeamRecord({ groups: [createTestGroup()] });
    await seedTeam(team);
    guards.authorizeTeamAdmin.mockResolvedValue({ error: "Admin access required", success: false });

    expect(await run()).toEqual({ error: "Admin access required", success: false });
    expect(guards.authorizeTeamAdmin).toHaveBeenCalledWith(VALID_UUID);
    expect(await harness.readTeam()).toEqual(team);
  });
});

describe("addGroup", () => {
  it("returns error when name is empty", async () => {
    const result = await changeTeam(VALID_UUID, "addGroup", { name: "" });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.toLowerCase()).toContain("name");
    }
  });

  it("returns error when team is not found", async () => {
    const result = await changeTeam(VALID_UUID, "addGroup", { name: "Design" });

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("assigns order based on existing group count", async () => {
    await seedTeam(
      createTestTeamRecord({
        groups: [createTestGroup({ id: "g1", order: 0 }), createTestGroup({ id: "g2", order: 1 })],
      }),
    );

    expect(await changeTeam(VALID_UUID, "addGroup", { name: "Design" })).toEqual({
      data: undefined,
      success: true,
    });
    const saved = await persistedTeam();
    expect(saved.groups[2]).toEqual({ id: "test-uuid", name: "Design", order: 2 });
  });

  it("persists the new group", async () => {
    await seedTeam(createTestTeamRecord({ groups: [] }));

    await changeTeam(VALID_UUID, "addGroup", { name: "Design" });

    const saved = await persistedTeam();
    expect(saved.groups).toHaveLength(1);
    expect(saved.groups[0]?.name).toBe("Design");
  });
});

describe("updateGroup", () => {
  it("returns error when groupId is not a UUID", async () => {
    const result = await changeTeam(VALID_UUID, "updateGroup", {
      groupId: "not-a-uuid",
      name: "X",
    });

    expect(result).toEqual({ error: "Invalid group ID", success: false });
  });

  it("returns error when team is not found", async () => {
    const result = await changeTeam(VALID_UUID, "updateGroup", {
      groupId: VALID_UUID_2,
      name: "New Name",
    });

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("returns error when group is not found", async () => {
    await seedTeam(createTestTeamRecord({ groups: [createTestGroup()] }));

    const result = await changeTeam(VALID_UUID, "updateGroup", {
      groupId: VALID_UUID_3,
      name: "New Name",
    });

    expect(result).toEqual({ error: "Group not found", success: false });
  });

  it("persists the updated group", async () => {
    await seedTeam(
      createTestTeamRecord({
        groups: [createTestGroup({ id: VALID_UUID_2, name: "Engineering" })],
      }),
    );

    const result = await changeTeam(VALID_UUID, "updateGroup", {
      groupId: VALID_UUID_2,
      name: "Product",
    });

    expect(result.success).toBe(true);
    const persisted = await persistedTeam();
    expect(persisted.groups[0]?.name).toBe("Product");
  });
});

describe("removeGroup", () => {
  it("returns error when groupId is not a UUID", async () => {
    const result = await changeTeam(VALID_UUID, "removeGroup", { groupId: "not-a-uuid" });

    expect(result).toEqual({ error: "Invalid group ID", success: false });
  });

  it("returns error when team is not found", async () => {
    const result = await changeTeam(VALID_UUID, "removeGroup", { groupId: VALID_UUID_2 });

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("returns error when group is not found", async () => {
    await seedTeam(createTestTeamRecord({ groups: [createTestGroup({ id: VALID_UUID_3 })] }));

    const result = await changeTeam(VALID_UUID, "removeGroup", { groupId: VALID_UUID_2 });

    expect(result).toEqual({ error: "Group not found", success: false });
  });

  it("unassigns members belonging to the removed group", async () => {
    const groupId = VALID_UUID_2;
    await seedTeam(
      createTestTeamRecord({
        groups: [createTestGroup({ id: groupId }), createTestGroup({ id: VALID_UUID_3, order: 1 })],
        members: [
          createTestMember({ groupId, id: "m1" }),
          createTestMember({ groupId: VALID_UUID_3, id: "m2" }),
          createTestMember({ groupId: undefined, id: "m3" }),
        ],
      }),
    );

    const result = await changeTeam(VALID_UUID, "removeGroup", { groupId });

    expect(result.success).toBe(true);
    const saved = await persistedTeam();
    const m1 = saved.members.find((m) => m.id === "m1");
    const m2 = saved.members.find((m) => m.id === "m2");
    const m3 = saved.members.find((m) => m.id === "m3");
    expect(m1?.groupId).toBeUndefined();
    expect(m2?.groupId).toBe(VALID_UUID_3);
    expect(m3?.groupId).toBeUndefined();
  });

  it("reindexes remaining group order values", async () => {
    await seedTeam(
      createTestTeamRecord({
        groups: [
          createTestGroup({ id: "g1", name: "A", order: 0 }),
          createTestGroup({ id: VALID_UUID_2, name: "B", order: 1 }),
          createTestGroup({ id: "g3", name: "C", order: 2 }),
        ],
        members: [],
      }),
    );

    const result = await changeTeam(VALID_UUID, "removeGroup", { groupId: VALID_UUID_2 });

    expect(result.success).toBe(true);
    const saved = await persistedTeam();
    expect(saved.groups).toHaveLength(2);
    expect(saved.groups[0]).toEqual(expect.objectContaining({ id: "g1", order: 0 }));
    expect(saved.groups[1]).toEqual(expect.objectContaining({ id: "g3", order: 1 }));
  });
});

describe("reorderGroups", () => {
  it("returns error when team is not found", async () => {
    const result = await changeTeam(VALID_UUID, "reorderGroups", { groupIds: ["g1"] });

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("returns error when group IDs do not match existing groups", async () => {
    await seedTeam(
      createTestTeamRecord({
        groups: [createTestGroup({ id: "g1", order: 0 }), createTestGroup({ id: "g2", order: 1 })],
      }),
    );

    const result = await changeTeam(VALID_UUID, "reorderGroups", { groupIds: ["g1", "g3"] });

    expect(result).toEqual({ error: "Invalid group order", success: false });
  });

  it("returns error when group IDs count mismatches", async () => {
    await seedTeam(
      createTestTeamRecord({
        groups: [createTestGroup({ id: "g1", order: 0 }), createTestGroup({ id: "g2", order: 1 })],
      }),
    );

    const result = await changeTeam(VALID_UUID, "reorderGroups", { groupIds: ["g1"] });

    expect(result).toEqual({ error: "Invalid group order", success: false });
  });

  it("updates order values based on new positions", async () => {
    await seedTeam(
      createTestTeamRecord({
        groups: [
          createTestGroup({ id: "g1", name: "A", order: 0 }),
          createTestGroup({ id: "g2", name: "B", order: 1 }),
          createTestGroup({ id: "g3", name: "C", order: 2 }),
        ],
      }),
    );

    const result = await changeTeam(VALID_UUID, "reorderGroups", { groupIds: ["g3", "g1", "g2"] });

    expect(result.success).toBe(true);
    const saved = await persistedTeam();
    expect(saved.groups[0]).toEqual(expect.objectContaining({ id: "g3", order: 0 }));
    expect(saved.groups[1]).toEqual(expect.objectContaining({ id: "g1", order: 1 }));
    expect(saved.groups[2]).toEqual(expect.objectContaining({ id: "g2", order: 2 }));
  });
});

describe("group limits", () => {
  it("allows the 50th group and rejects the next", async () => {
    await seedTeam(
      createTestTeamRecord({
        groups: Array.from({ length: 49 }, (_, index) => createTestGroup({ id: `group-${index}` })),
      }),
    );
    const result1 = await changeTeam(VALID_UUID, "addGroup", { name: "Last group" });
    expect(result1.success).toBe(true);
    expect(await changeTeam(VALID_UUID, "addGroup", { name: "Too many" })).toEqual({
      error: "A workspace can have up to 50 groups",
      success: false,
    });
    const persisted = await persistedTeam();
    expect(persisted.groups).toHaveLength(50);
  });
});

describe("write failures", () => {
  it("names the change when the write itself fails", async () => {
    const store = createTeamStore({
      createId: () => VALID_UUID,
      invalidateTeamName: vi.fn<() => void>(),
      storage: {
        ...postgresTeamStorage,
        write: () => Promise.reject(new Error("Postgres unavailable")),
      },
    });

    await seedTeam(createTestTeamRecord());

    const failingChange = createTeamChangeAction({
      applyTeamCommand: store.applyTeamCommand,
      authorizeTeamAdmin: guards.authorizeTeamAdmin,
      authorizeTeamMember: guards.authorizeTeamMember,
      reportError,
      revokeMemberAccess: harness.revokeMemberAccess,
    });

    expect(await failingChange(VALID_UUID, "renameTeam", { name: "Renamed" })).toEqual({
      error: "Failed to update team name",
      success: false,
    });
  });
});
