import { describe, expect, it, vi } from "vitest";

import type { TeamRecord } from "@/types";

import {
  createTestGroup,
  createTestMember,
  createTestTeamRecord,
  VALID_UUID,
  VALID_UUID_2,
  VALID_UUID_3,
} from "./actions/test-helpers";
import { newTeamMember, type TeamCommand, teamCommands } from "./team-commands";
import { createMemoryTeamStorage } from "./team-memory-storage";
import { createTeamStore } from "./team-store";

const memberInput = {
  name: "Ada",
  timezone: "Europe/Berlin",
  title: "Engineer",
  workingHoursEnd: 17,
  workingHoursStart: 9,
};

const storeWith = async (team: TeamRecord) => {
  let issued = 0;

  const store = createTeamStore({
    createId: () => {
      issued += 1;

      return `new-${issued}`;
    },
    invalidateTeamName: vi.fn<() => void>(),
    reportError: vi.fn<() => void>(),
    storage: createMemoryTeamStorage(),
  });

  await store.createTeamContents(VALID_UUID, team);

  return {
    apply: <TValue>(command: TeamCommand<TValue>) => store.applyTeamCommand(VALID_UUID, command),
    stored: async () => (await store.readTeamRecord(VALID_UUID)) ?? createTestTeamRecord(),
  };
};

const members = (count: number) =>
  Array.from({ length: count }, (_, index) => createTestMember({ id: `member-${index}` }));

describe("member cap", () => {
  it("lets an add reach the cap and refuses the next one", async () => {
    const team = await storeWith(createTestTeamRecord({ members: members(199) }));

    const applied = await team.apply(teamCommands.addMember(memberInput));
    expect(applied.ok).toBe(true);
    expect(await team.apply(teamCommands.addMember(memberInput))).toMatchObject({
      error: "A workspace can have up to 200 members",
      ok: false,
    });
    const stored = await team.stored();
    expect(stored.members).toHaveLength(200);
  });

  it("refuses an import past the cap without a partial write", async () => {
    const team = await storeWith(createTestTeamRecord({ members: members(199) }));

    expect(await team.apply(teamCommands.importMembers([memberInput, memberInput]))).toMatchObject({
      error: "A workspace can have up to 200 members",
      ok: false,
    });
    const stored = await team.stored();
    expect(stored.members).toHaveLength(199);
  });

  it("refuses a fallback slot past the cap while still allowing a claim", async () => {
    const team = await storeWith(createTestTeamRecord({ members: members(200) }));

    const applied = await team.apply(teamCommands.claimMemberSlot({ name: "Bob", userId: "bob" }));
    expect(applied.ok).toBe(false);
    expect(
      await team.apply(
        teamCommands.claimMemberSlot({ memberId: "member-0", name: "Bob", userId: "bob" }),
      ),
    ).toMatchObject({ ok: true, value: { created: false, memberId: "member-0" } });
  });
});

describe("member groups", () => {
  it("refuses a groupId that names no group on add, import and update", async () => {
    const team = await storeWith(createTestTeamRecord({ members: [createTestMember()] }));
    const grouped = { ...memberInput, groupId: VALID_UUID_2 };

    const results = await Promise.all([
      team.apply(teamCommands.addMember(grouped)),
      team.apply(teamCommands.importMembers([grouped])),
      team.apply(teamCommands.updateMember(VALID_UUID, { groupId: VALID_UUID_2 })),
    ]);

    for (const result of results) {
      expect(result).toEqual({ error: "Group not found", ok: false, reason: "rejected" });
    }

    const stored = await team.stored();
    expect(stored.members).toEqual([createTestMember()]);
  });

  it("assigns an existing group and clears it again", async () => {
    const team = await storeWith(
      createTestTeamRecord({
        groups: [createTestGroup({ id: VALID_UUID_2 })],
        members: [createTestMember()],
      }),
    );

    await team.apply(teamCommands.updateMember(VALID_UUID, { groupId: VALID_UUID_2 }));
    const assigned = await team.stored();
    expect(assigned.members[0]?.groupId).toBe(VALID_UUID_2);

    await team.apply(teamCommands.updateMember(VALID_UUID, { groupId: undefined }));
    const cleared = await team.stored();
    expect(cleared.members[0]?.groupId).toBeUndefined();
  });

  it("unassigns the members of a removed group and reindexes the rest", async () => {
    const team = await storeWith(
      createTestTeamRecord({
        groups: [
          createTestGroup({ id: VALID_UUID_2, order: 0 }),
          createTestGroup({ id: VALID_UUID_3, order: 1 }),
        ],
        members: [
          createTestMember({ groupId: VALID_UUID_2, id: "m1" }),
          createTestMember({ groupId: VALID_UUID_3, id: "m2" }),
        ],
      }),
    );

    await team.apply(teamCommands.removeGroup(VALID_UUID_2));

    const stored = await team.stored();
    expect(stored.groups).toEqual([expect.objectContaining({ id: VALID_UUID_3, order: 0 })]);
    expect(stored.members.map((member) => member.groupId)).toEqual([undefined, VALID_UUID_3]);
  });

  it("caps groups", async () => {
    const team = await storeWith(
      createTestTeamRecord({
        groups: Array.from({ length: 50 }, (_, index) => createTestGroup({ id: `g-${index}` })),
      }),
    );

    expect(await team.apply(teamCommands.addGroup("One more"))).toMatchObject({
      error: "A workspace can have up to 50 groups",
      ok: false,
    });
  });
});

describe("ordering", () => {
  it("imports after the existing members in order", async () => {
    const team = await storeWith(createTestTeamRecord({ members: [createTestMember()] }));

    const result = await team.apply(
      teamCommands.importMembers([memberInput, { ...memberInput, name: "Grace" }]),
    );

    expect(result).toMatchObject({
      ok: true,
      value: [
        { id: "new-1", name: "Ada", order: 1 },
        { id: "new-2", name: "Grace", order: 2 },
      ],
    });
  });

  it("refuses a reorder that drops, invents or repeats an id", async () => {
    const team = await storeWith(
      createTestTeamRecord({
        members: [createTestMember({ id: "a" }), createTestMember({ id: "b", order: 1 })],
      }),
    );

    const refused = await Promise.all(
      [["a"], ["a", "c"], ["a", "b", "a"]].map((ids) =>
        team.apply(teamCommands.reorderMembers(ids)),
      ),
    );

    expect(refused.every((result) => !result.ok && result.error === "Invalid member order")).toBe(
      true,
    );

    await team.apply(teamCommands.reorderMembers(["b", "a"]));
    const stored = await team.stored();
    expect(stored.members.map((member) => [member.id, member.order])).toEqual([
      ["b", 0],
      ["a", 1],
    ]);
  });
});

describe("member slots", () => {
  it("claims an unowned slot and keeps its timezone and hours", async () => {
    const team = await storeWith(createTestTeamRecord({ members: [createTestMember()] }));

    expect(
      await team.apply(
        teamCommands.claimMemberSlot({ memberId: VALID_UUID, name: "Bob", userId: "bob" }),
      ),
    ).toMatchObject({ ok: true, value: { created: false, memberId: VALID_UUID } });
    const stored = await team.stored();
    expect(stored.members[0]).toMatchObject({
      name: "Alice",
      timezone: "America/New_York",
      userId: "bob",
    });
  });

  it("creates a fallback slot rather than take another user's profile", async () => {
    const team = await storeWith(
      createTestTeamRecord({ members: [createTestMember({ userId: "someone-else" })] }),
    );

    expect(
      await team.apply(
        teamCommands.claimMemberSlot({ memberId: VALID_UUID, name: "Bob", userId: "bob" }),
      ),
    ).toMatchObject({ ok: true, value: { created: true, memberId: "new-1" } });
    const stored = await team.stored();
    expect(stored.members[1]).toMatchObject({ name: "Bob", order: 1, userId: "bob" });
  });

  it("lets a user edit and claim only their own profile", async () => {
    const team = await storeWith(
      createTestTeamRecord({
        members: [createTestMember({ id: "free" }), createTestMember({ id: "taken", userId: "x" })],
      }),
    );

    expect(
      await team.apply(teamCommands.updateOwnMember("taken", "bob", { name: "Bob" })),
    ).toMatchObject({ error: "You can only edit your own member record", ok: false });
    expect(
      await team.apply(teamCommands.updateOwnMember("free", "bob", { name: "Bob" })),
    ).toMatchObject({ ok: true, value: { id: "free", name: "Bob", userId: "bob" } });
  });

  it("refuses a second profile for a user who already owns one", async () => {
    const owned = createTestMember({ id: "mine", userId: "bob" });

    const team = await storeWith(
      createTestTeamRecord({ members: [owned, createTestMember({ id: "free" })] }),
    );

    expect(
      await team.apply(teamCommands.updateOwnMember("free", "bob", { name: "Bob" })),
    ).toMatchObject({ error: "You already have a profile on this team", ok: false });
    const stored = await team.stored();
    expect(stored.members).toEqual([owned, createTestMember({ id: "free" })]);
  });

  it("reuses a user's existing profile", async () => {
    const owned = createTestMember({ userId: "bob" });
    const team = await storeWith(createTestTeamRecord({ members: [owned] }));
    expect(
      await team.apply(teamCommands.claimMemberSlot({ name: "Bob", userId: "bob" })),
    ).toMatchObject({ ok: true, value: { created: false, memberId: owned.id } });
    const storedTeam = await team.stored();
    expect(storedTeam.members).toEqual([owned]);
  });
  it("removes a member inside the team transaction", async () => {
    const team = await storeWith(createTestTeamRecord({ members: [createTestMember()] }));
    expect(await team.apply(teamCommands.removeMember(VALID_UUID))).toMatchObject({ ok: true });
    const storedTeam = await team.stored();
    expect(storedTeam.members).toEqual([]);
  });
});

describe("newTeamMember", () => {
  it("fills the shared defaults and lets a caller override them", () => {
    expect(newTeamMember("id-1")).toEqual({
      id: "id-1",
      name: "",
      order: 0,
      timezone: "America/New_York",
      title: "",
      workingHoursEnd: 17,
      workingHoursStart: 9,
    });
    expect(newTeamMember("id-1", { order: 3, timezone: "Europe/Berlin" })).toMatchObject({
      order: 3,
      timezone: "Europe/Berlin",
      workingHoursStart: 9,
    });
  });
});
