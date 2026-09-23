import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMemberActions } from "./member-actions-core";
import {
  createTestGuards,
  createTestMember,
  createTestTeamMutator,
  createTestTeamRecord,
  VALID_UUID,
  VALID_UUID_2,
  VALID_UUID_3,
} from "./test-helpers";

type MemberActionDeps = Parameters<typeof createMemberActions>[0];

const testMutator = createTestTeamMutator();
const guards = createTestGuards();
const claimOrCreateSlot = vi.fn<MemberActionDeps["claimOrCreateSlot"]>();
const revokeInvitationsForMember = vi.fn<MemberActionDeps["revokeInvitationsForMember"]>();
const removeMembershipForSlot = vi.fn<MemberActionDeps["removeMembershipForSlot"]>();
const reportError = vi.fn<MemberActionDeps["reportError"]>();
const revalidateTeamName = vi.fn<MemberActionDeps["revalidateTeamName"]>();
const {
  addMember,
  createOwnMemberSlot,
  importMembers,
  removeMember,
  reorderMembers,
  updateMember,
  updateOwnMember,
  updateTeamName,
} = createMemberActions({
  authorizeTeamAdmin: guards.authorizeTeamAdmin,
  authorizeTeamMember: guards.authorizeTeamMember,
  claimOrCreateSlot,
  createId: () => "test-uuid",
  mutateTeam: testMutator.mutateTeam,
  readTeam: () => Promise.resolve(testMutator.persistedTeam()),
  removeMembershipForSlot,
  reportError,
  revalidateTeamName,
  revokeInvitationsForMember,
});

const seedTeam = (team: ReturnType<typeof createTestTeamRecord>) => {
  testMutator.seedTeam(team);
};

const persistedTeam = () => {
  const team = testMutator.persistedTeam();
  if (!team) {
    throw new Error("team was not persisted");
  }
  return team;
};

const validMemberInput = {
  name: "Alice",
  timezone: "America/New_York",
  title: "Engineer",
  workingHoursEnd: 17,
  workingHoursStart: 9,
};

beforeEach(() => {
  testMutator.reset();
  guards.reset();
  claimOrCreateSlot.mockReset();
  revokeInvitationsForMember.mockReset();
  removeMembershipForSlot.mockReset();
  reportError.mockReset();
  revalidateTeamName.mockReset();
});

describe("authorization", () => {
  it.each([
    ["addMember", () => addMember(VALID_UUID, { ...validMemberInput, name: "" })],
    ["removeMember", () => removeMember(VALID_UUID, VALID_UUID_2)],
    ["updateMember", () => updateMember(VALID_UUID, VALID_UUID_2, { name: "" })],
    ["updateTeamName", () => updateTeamName(VALID_UUID, "")],
    ["importMembers", () => importMembers(VALID_UUID, [])],
    ["reorderMembers", () => reorderMembers(VALID_UUID, [])],
  ])("%s refuses a non-admin before validating input or cleanup", async (_name, run) => {
    const team = createTestTeamRecord({
      members: [createTestMember({ id: VALID_UUID_2, userId: "other" })],
    });
    seedTeam(team);
    guards.authorizeTeamAdmin.mockResolvedValue({ error: "Admin access required", success: false });

    expect(await run()).toEqual({ error: "Admin access required", success: false });
    expect(guards.authorizeTeamAdmin).toHaveBeenCalledWith(VALID_UUID);
    expect(revokeInvitationsForMember).not.toHaveBeenCalled();
    expect(removeMembershipForSlot).not.toHaveBeenCalled();
    expect(revalidateTeamName).not.toHaveBeenCalled();
    expect(testMutator.persistedTeam()).toEqual(team);
  });

  it.each([
    ["updateOwnMember", () => updateOwnMember(VALID_UUID, VALID_UUID_2, { name: "" })],
    ["createOwnMemberSlot", () => createOwnMemberSlot(VALID_UUID)],
  ])("%s refuses a non-member before touching the team", async (_name, run) => {
    guards.authorizeTeamMember.mockResolvedValue({
      error: "You are not a member of this team",
      success: false,
    });

    expect(await run()).toEqual({ error: "You are not a member of this team", success: false });
    expect(guards.authorizeTeamMember).toHaveBeenCalledWith(VALID_UUID);
    expect(claimOrCreateSlot).not.toHaveBeenCalled();
  });
});

describe("addMember", () => {
  it("returns error when team not found", async () => {
    testMutator.seedTeam(null);

    const result = await addMember(VALID_UUID, validMemberInput);

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("assigns order equal to team.members.length", async () => {
    const existingMember = createTestMember({ id: VALID_UUID_2, order: 0 });
    seedTeam(createTestTeamRecord({ members: [existingMember] }));

    const result = await addMember(VALID_UUID, validMemberInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.member.order).toBe(1);
      expect(result.data.member.id).toBe("test-uuid");
    }
  });

  it("pushes member to team and persists", async () => {
    seedTeam(createTestTeamRecord({ members: [] }));

    await addMember(VALID_UUID, validMemberInput);

    expect(persistedTeam().members).toHaveLength(1);
  });
});

describe("removeMember", () => {
  it("returns error when memberId is not a UUID", async () => {
    const result = await removeMember(VALID_UUID, "not-a-uuid");

    expect(result).toEqual({ error: "Invalid member ID", success: false });
  });

  it("returns error when team not found", async () => {
    testMutator.seedTeam(null);

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
  it("trims name and revalidates the cached name", async () => {
    seedTeam(createTestTeamRecord());

    await updateTeamName(VALID_UUID, "  My Team  ");

    expect(persistedTeam().name).toBe("My Team");
    expect(revalidateTeamName).toHaveBeenCalledWith(VALID_UUID);
  });

  it("rejects empty name after trimming", async () => {
    const result = await updateTeamName(VALID_UUID, "   ");

    expect(result).toEqual({ error: "Workspace name is required", success: false });
    expect(revalidateTeamName).not.toHaveBeenCalled();
  });

  it("rejects names longer than 100 characters", async () => {
    seedTeam(createTestTeamRecord());
    const longName = "A".repeat(150);

    const result = await updateTeamName(VALID_UUID, longName);
    expect(result.success).toBe(false);
    expect(persistedTeam().name).toBe("Test Team");
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

    const result = await importMembers(VALID_UUID, members);

    expect(result).toEqual({
      error: "Cannot import more than 100 members at once",
      success: false,
    });
  });

  it("assigns orders starting from existing member count", async () => {
    const existing = createTestMember({ id: VALID_UUID_2, order: 0 });
    seedTeam(createTestTeamRecord({ members: [existing] }));

    const result = await importMembers(VALID_UUID, [
      validMemberInput,
      { ...validMemberInput, name: "Bob" },
    ]);

    expect(result.success).toBe(true);
    const saved = persistedTeam();
    expect(saved.members[1].order).toBe(1);
    expect(saved.members[2].order).toBe(2);
  });

  it("returns error when team not found", async () => {
    testMutator.seedTeam(null);

    const result = await importMembers(VALID_UUID, [validMemberInput]);

    expect(result).toEqual({ error: "Team not found", success: false });
  });
});

describe("updateOwnMember", () => {
  it("requires membership rather than admin access", async () => {
    seedTeam(
      createTestTeamRecord({
        members: [createTestMember({ id: VALID_UUID_2, userId: "user-123" })],
      }),
    );

    await updateOwnMember(VALID_UUID, VALID_UUID_2, { name: "Updated" });

    expect(guards.authorizeTeamMember).toHaveBeenCalledWith(VALID_UUID);
    expect(guards.authorizeTeamAdmin).not.toHaveBeenCalled();
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
});

describe("reorderMembers", () => {
  it("returns error when team not found", async () => {
    testMutator.seedTeam(null);

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

describe("member limits", () => {
  it("allows the 200th member and rejects the next", async () => {
    seedTeam(
      createTestTeamRecord({
        members: Array.from({ length: 199 }, (_, index) =>
          createTestMember({ id: `member-${index}` }),
        ),
      }),
    );
    const result1 = await addMember(VALID_UUID, validMemberInput);
    expect(result1.success).toBe(true);
    const result2 = await addMember(VALID_UUID, validMemberInput);
    expect(result2.success).toBe(false);
    expect(persistedTeam().members).toHaveLength(200);
  });

  it("rejects an oversized total import without partial writes", async () => {
    seedTeam(
      createTestTeamRecord({
        members: Array.from({ length: 199 }, (_, index) =>
          createTestMember({ id: `member-${index}` }),
        ),
      }),
    );
    expect(await importMembers(VALID_UUID, [validMemberInput, validMemberInput])).toEqual({
      error: "A workspace can have up to 200 members",
      success: false,
    });
    expect(persistedTeam().members).toHaveLength(199);
    const result3 = await importMembers(VALID_UUID, [validMemberInput]);
    expect(result3.success).toBe(true);
    expect(persistedTeam().members).toHaveLength(200);
  });
});

describe("removal cleanup and self repair", () => {
  it("keeps the slot when revocation fails and can retry", async () => {
    seedTeam(
      createTestTeamRecord({ members: [createTestMember({ id: VALID_UUID_2, userId: "other" })] }),
    );
    revokeInvitationsForMember.mockRejectedValueOnce(new Error("Database unavailable"));
    expect(await removeMember(VALID_UUID, VALID_UUID_2)).toMatchObject({ success: false });
    expect(persistedTeam().members).toHaveLength(1);
    expect(removeMembershipForSlot).not.toHaveBeenCalled();
    expect(await removeMember(VALID_UUID, VALID_UUID_2)).toMatchObject({ success: true });
    expect(removeMembershipForSlot).toHaveBeenCalledWith(VALID_UUID, "other", "user-123");
  });
  it("retains the slot until membership cleanup succeeds", async () => {
    seedTeam(
      createTestTeamRecord({ members: [createTestMember({ id: VALID_UUID_2, userId: "other" })] }),
    );
    removeMembershipForSlot.mockImplementationOnce(() => {
      expect(persistedTeam().members).toHaveLength(1);
      return Promise.reject(new Error("Database unavailable"));
    });
    expect(await removeMember(VALID_UUID, VALID_UUID_2)).toMatchObject({ success: false });
    expect(persistedTeam().members).toHaveLength(1);
    expect(revokeInvitationsForMember).toHaveBeenCalledWith(VALID_UUID, VALID_UUID_2);
  });
  it("retains a profile claimed by another user during cleanup", async () => {
    seedTeam(
      createTestTeamRecord({ members: [createTestMember({ id: VALID_UUID_2, userId: "other" })] }),
    );
    removeMembershipForSlot.mockImplementationOnce(() => {
      persistedTeam().members[0].userId = "new-owner";
      return Promise.resolve();
    });
    expect(await removeMember(VALID_UUID, VALID_UUID_2)).toMatchObject({ success: false });
    expect(persistedTeam().members[0].userId).toBe("new-owner");
  });
  it("does not delete the caller membership", async () => {
    seedTeam(
      createTestTeamRecord({
        members: [createTestMember({ id: VALID_UUID_2, userId: "user-123" })],
      }),
    );
    expect(await removeMember(VALID_UUID, VALID_UUID_2)).toMatchObject({ success: true });
    expect(removeMembershipForSlot).not.toHaveBeenCalled();
  });
  it("returns an existing profile without creating another", async () => {
    claimOrCreateSlot.mockResolvedValue({ created: false, memberId: VALID_UUID_2, ok: true });
    expect(await createOwnMemberSlot(VALID_UUID)).toEqual({
      data: { created: false, memberId: VALID_UUID_2 },
      success: true,
    });
  });
});
