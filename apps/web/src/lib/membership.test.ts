import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamRecord } from "@/types";

import {
  createMockSession,
  createTestMember,
  createTestTeamRecord,
  createTestTeamStore,
  VALID_UUID,
  VALID_UUID_2,
} from "./actions/test-helpers";

const ADMIN_ID = "user-123";
const access = { teamId: VALID_UUID, user: createMockSession({ userId: ADMIN_ID }).user };
const bob = { role: "MEMBER" as const, teamId: VALID_UUID, userId: "bob" };
const invitedSlot = createTestMember({ id: VALID_UUID_2 });
const bobsSlot = createTestMember({ id: VALID_UUID_2, userId: "bob" });

const harness = createTestTeamStore();

const roster = async () => {
  const team = await harness.readTeam();

  return team?.members ?? [];
};

const seed = (team: TeamRecord = createTestTeamRecord({ members: [invitedSlot] })) =>
  harness.seedTeam(team);

beforeEach(() => {
  harness.reset();
});

describe("grantMembership", () => {
  it("claims the invited slot and creates the membership", async () => {
    await seed();

    expect(
      await harness.grantMembership({ ...bob, slot: { memberId: VALID_UUID_2, name: "Bob" } }),
    ).toEqual({ memberId: VALID_UUID_2, ok: true });
    expect(await roster()).toMatchObject([bobsSlot]);
    expect(harness.findMembership("bob")).toEqual({ archivedAt: null, role: "MEMBER" });
  });

  it("leaves no membership when the slot claim fails", async () => {
    expect(await harness.grantMembership({ ...bob, slot: { name: "Bob" } })).toEqual({
      error: "Team not found",
      ok: false,
      reason: "rejected",
    });
    expect(harness.findMembership("bob")).toBeNull();
  });

  it("removes a slot it created when the membership write fails", async () => {
    await seed(createTestTeamRecord());
    harness.membershipStore.grant.mockRejectedValue(new Error("Database unavailable"));

    await expect(harness.grantMembership({ ...bob, slot: { name: "Bob" } })).rejects.toThrow(
      "Database unavailable",
    );
    expect(await roster()).toEqual([]);
  });

  it("hands a claimed slot back when the caller's commit fails", async () => {
    await seed();
    const commit = vi.fn<() => Promise<void>>();
    commit.mockRejectedValue(new Error("Invitation is no longer pending"));

    await expect(
      harness.grantMembership({ ...bob, commit, slot: { memberId: VALID_UUID_2, name: "Bob" } }),
    ).rejects.toThrow("Invitation is no longer pending");
    expect(commit).toHaveBeenCalledWith(bob, VALID_UUID_2, undefined);
    expect(await roster()).toEqual([invitedSlot]);
    expect(harness.findMembership("bob")).toBeNull();
  });

  it("keeps a slot the user already owned when the membership write fails", async () => {
    await seed(createTestTeamRecord({ members: [bobsSlot] }));
    harness.membershipStore.grant.mockRejectedValue(new Error("Database unavailable"));

    await expect(harness.grantMembership({ ...bob, slot: { name: "Bob" } })).rejects.toThrow(
      "Database unavailable",
    );
    expect(await roster()).toMatchObject([bobsSlot]);
  });

  it("grants a password viewer access without a roster slot", async () => {
    await seed();

    await harness.grantMembership({ ...bob, slot: null });

    expect(harness.findMembership("bob")).toEqual({ archivedAt: null, role: "MEMBER" });
    expect(await roster()).toEqual([invitedSlot]);
  });

  it("un-archives a returning member and keeps their role", async () => {
    harness.seedMembership("bob", "ADMIN", new Date());

    await harness.grantMembership({ ...bob, slot: null });

    expect(harness.findMembership("bob")).toEqual({ archivedAt: null, role: "ADMIN" });
  });
});

describe("revokeMembership", () => {
  it("revokes access and pending invitations, then removes the slot", async () => {
    await seed(createTestTeamRecord({ members: [bobsSlot] }));
    harness.seedMembership("bob");

    expect(await harness.revokeMembership({ access, memberId: VALID_UUID_2 })).toMatchObject({
      ok: true,
      value: bobsSlot,
    });
    expect(await roster()).toEqual([]);
    expect(harness.findMembership("bob")).toBeNull();
    expect(harness.invitationsRevoked(VALID_UUID_2)).toBe(true);
  });

  it("leaves access intact when the contents reject the removal", async () => {
    await seed(createTestTeamRecord({ members: [bobsSlot] }));
    harness.seedMembership("bob");

    expect(await harness.revokeMembership({ access, memberId: "missing" })).toEqual({
      error: "Member not found",
      ok: false,
      reason: "rejected",
    });
    expect(harness.findMembership("bob")).not.toBeNull();
    expect(harness.membershipStore.revoke).not.toHaveBeenCalled();
  });

  it("keeps the slot on the roster when revoking access fails", async () => {
    await seed(createTestTeamRecord({ members: [bobsSlot] }));
    harness.membershipStore.revoke.mockRejectedValue(new Error("Database unavailable"));

    await expect(harness.revokeMembership({ access, memberId: VALID_UUID_2 })).rejects.toThrow(
      "Database unavailable",
    );
    expect(await roster()).toMatchObject([bobsSlot]);
  });

  it("keeps the remover's own membership", async () => {
    await seed(createTestTeamRecord({ members: [createTestMember({ userId: ADMIN_ID })] }));
    harness.seedMembership(ADMIN_ID);

    expect(await harness.revokeMembership({ access, memberId: VALID_UUID })).toMatchObject({
      ok: true,
    });
    expect(await roster()).toEqual([]);
    expect(harness.findMembership(ADMIN_ID)).not.toBeNull();
  });

  it("publishes only committed membership changes", async () => {
    await seed();

    const granted = await harness.grantMembership({
      ...bob,
      slot: { memberId: VALID_UUID_2, name: "Bob" },
    });

    expect(granted.ok).toBe(true);
    expect(harness.publish).toHaveBeenCalledExactlyOnceWith(VALID_UUID);
    harness.publish.mockClear();
    harness.membershipStore.revoke.mockRejectedValueOnce(new Error("rollback"));
    await expect(harness.revokeMembership({ access, memberId: VALID_UUID_2 })).rejects.toThrow(
      "rollback",
    );
    expect(harness.publish).not.toHaveBeenCalled();
    expect(harness.findMembership("bob")).not.toBeNull();
    expect(await roster()).toMatchObject([bobsSlot]);
  });
});
