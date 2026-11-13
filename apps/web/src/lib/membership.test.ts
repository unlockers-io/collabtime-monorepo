// @vitest-environment node
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

beforeEach(() => harness.reset());

describe("grantMembership", () => {
  it("claims the invited slot and creates the membership", async () => {
    await seed();

    expect(await harness.grantMembership(bob, { memberId: VALID_UUID_2, name: "Bob" })).toEqual({
      memberId: VALID_UUID_2,
      ok: true,
    });
    expect(await roster()).toMatchObject([bobsSlot]);
    expect(await harness.findMembership("bob")).toEqual({ archivedAt: null, role: "MEMBER" });
  });

  it("leaves no membership when the slot claim fails", async () => {
    expect(await harness.grantMembership(bob, { name: "Bob" })).toEqual({
      error: "Team not found",
      ok: false,
    });
    expect(await harness.findMembership("bob")).toBeNull();
  });

  it("removes a slot it created when the membership write fails", async () => {
    await seed(createTestTeamRecord());
    harness.membershipStore.grant.mockRejectedValue(new Error("Database unavailable"));

    await expect(harness.grantMembership(bob, { name: "Bob" })).rejects.toThrow(
      "Database unavailable",
    );
    expect(await roster()).toEqual([]);
  });

  it("hands a claimed slot back when what the grant answers fails", async () => {
    await seed();
    const first = vi.fn<() => Promise<void>>();
    first.mockRejectedValue(new Error("Invitation is no longer pending"));

    await expect(
      harness.grantMembership(bob, { memberId: VALID_UUID_2, name: "Bob" }, first),
    ).rejects.toThrow("Invitation is no longer pending");
    expect(first).toHaveBeenCalledWith(VALID_UUID_2, expect.anything());
    expect(await roster()).toEqual([invitedSlot]);
    expect(await harness.findMembership("bob")).toBeNull();
  });

  it("keeps a slot the user already owned when the membership write fails", async () => {
    await seed(createTestTeamRecord({ members: [bobsSlot] }));
    harness.membershipStore.grant.mockRejectedValue(new Error("Database unavailable"));

    await expect(harness.grantMembership(bob, { name: "Bob" })).rejects.toThrow(
      "Database unavailable",
    );
    expect(await roster()).toMatchObject([bobsSlot]);
  });

  it("grants a password viewer access without a roster slot", async () => {
    await seed();

    await harness.grantViewerAccess(bob);

    expect(await harness.findMembership("bob")).toEqual({ archivedAt: null, role: "MEMBER" });
    expect(await roster()).toEqual([invitedSlot]);
  });

  it("un-archives a returning member and keeps their role", async () => {
    await harness.seedMembership("bob", "ADMIN", new Date());

    await harness.grantViewerAccess(bob);

    expect(await harness.findMembership("bob")).toEqual({ archivedAt: null, role: "ADMIN" });
  });
});

describe("revokeMembership", () => {
  it("revokes access and pending invitations, then removes the slot", async () => {
    await seed(createTestTeamRecord({ members: [bobsSlot] }));
    await harness.seedMembership("bob");
    await harness.seedInvitation(VALID_UUID_2);

    expect(await harness.revokeMembership({ access, memberId: VALID_UUID_2 })).toMatchObject({
      ok: true,
      value: bobsSlot,
    });
    expect(await roster()).toEqual([]);
    expect(await harness.findMembership("bob")).toBeNull();
    expect(await harness.invitationStatus(VALID_UUID_2)).toBe("REVOKED");
  });

  it("leaves access intact when the contents reject the removal", async () => {
    await seed(createTestTeamRecord({ members: [bobsSlot] }));
    await harness.seedMembership("bob");

    expect(await harness.revokeMembership({ access, memberId: "missing" })).toEqual({
      error: "Member not found",
      ok: false,
    });
    expect(await harness.findMembership("bob")).not.toBeNull();
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
    await harness.seedMembership(ADMIN_ID);

    expect(await harness.revokeMembership({ access, memberId: VALID_UUID })).toMatchObject({
      ok: true,
    });
    expect(await roster()).toEqual([]);
    expect(await harness.findMembership(ADMIN_ID)).not.toBeNull();
  });

  it("publishes only committed membership changes", async () => {
    await seed();

    const granted = await harness.grantMembership(bob, { memberId: VALID_UUID_2, name: "Bob" });

    expect(granted.ok).toBe(true);
    expect(harness.publish).toHaveBeenCalledExactlyOnceWith(VALID_UUID, ["contents", "space"]);
    harness.publish.mockClear();
    harness.membershipStore.revoke.mockRejectedValueOnce(new Error("rollback"));
    await expect(harness.revokeMembership({ access, memberId: VALID_UUID_2 })).rejects.toThrow(
      "rollback",
    );
    expect(harness.publish).not.toHaveBeenCalled();
    expect(await harness.findMembership("bob")).not.toBeNull();
    expect(await roster()).toMatchObject([bobsSlot]);
  });
});
