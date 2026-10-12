import { setImmediate } from "node:timers/promises";

import { describe, expect, it, vi } from "vitest";

import {
  createMockSession,
  createTestAccess,
  createTestMember,
  createTestTeamRecord,
  createTestTeamStore,
  VALID_UUID,
  VALID_UUID_2,
} from "./actions/test-helpers";
import { createMemoryInvitationStore } from "./invitation-memory-store";
import { createInvitations, type InvitationDeps } from "./invitations";

const user = createMockSession({ email: "ivy@example.com", userId: "ivy" }).user;
const access = createTestAccess();
const NOW = new Date("2026-09-10T12:00:00Z");

const setup = async () => {
  const harness = createTestTeamStore();
  await harness.seedTeam(
    createTestTeamRecord({ members: [createTestMember({ id: VALID_UUID_2 })] }),
  );
  const clock = { now: NOW };
  const store = createMemoryInvitationStore(harness.membershipStore.grant, () => clock.now);
  const transition = vi.fn(store.transition);
  const deps: InvitationDeps<undefined> = {
    appUrl: () => "https://app.example.com",
    checkRateLimit: () => Promise.resolve({ allowed: true, remaining: 49 }),
    grantMembership: harness.grantMembership,
    isMember: () => Promise.resolve(false),
    notifyInviter: vi.fn<InvitationDeps<undefined>["notifyInviter"]>(),
    now: () => clock.now,
    readTeamRecord: harness.readTeam,
    reportError: vi.fn<InvitationDeps<undefined>["reportError"]>(),
    sendEmail: () => Promise.resolve({ sent: true }),
    store: { ...store, transition },
  };
  const invitations = createInvitations(deps);
  const invited = await invitations.invite(access, { email: user.email, memberId: VALID_UUID_2 });
  if (!invited.success) {
    throw new Error(invited.error);
  }
  const expire = () => {
    clock.now = new Date("2026-09-24T12:00:00Z");
  };
  return {
    deps,
    expire,
    grantMembership: harness.grantMembership,
    harness,
    id: invited.data.invitationId,
    invitations,
    store,
    transition,
  };
};

describe("invitation concurrency", () => {
  it("keeps the winning accept on the roster through a losing compensation and admin removal", async () => {
    const { deps, harness, id, invitations, store, transition } = await setup();
    const paused = Promise.withResolvers<undefined>();
    const resume = Promise.withResolvers<undefined>();
    transition.mockImplementationOnce(async (...args) => {
      paused.resolve(undefined);
      await resume.promise;
      return store.transition(...args);
    });
    const first = invitations.accept(user, id);
    await paused.promise;
    const second = createInvitations(deps).accept(user, id);
    await setImmediate();
    resume.resolve(undefined);
    const outcomes = await Promise.all([first, second]);

    expect(outcomes.filter((outcome) => outcome.success)).toHaveLength(1);
    const beforeRemoval = await harness.readTeam();
    expect(beforeRemoval?.members).toMatchObject([{ id: VALID_UUID_2, userId: user.id }]);
    expect(harness.findMembership(user.id)).not.toBeNull();
    expect(await harness.revokeMembership({ access, memberId: VALID_UUID_2 })).toMatchObject({
      ok: true,
    });
    const removed = await harness.readTeam();
    expect(removed?.members).toEqual([]);
    expect(harness.findMembership(user.id)).toBeNull();
  });

  it.each([true, false])(
    "serializes a concurrent revoke while membership commit succeeds=%s",
    async (succeeds) => {
      const { harness, id, invitations, store } = await setup();
      const paused = Promise.withResolvers<undefined>();
      const resume = Promise.withResolvers<undefined>();
      const persist = harness.membershipStore.grant.getMockImplementation();
      if (!persist) {
        throw new Error("Membership persistence must be configured");
      }
      harness.membershipStore.grant.mockImplementationOnce(async (grant, transaction) => {
        paused.resolve(undefined);
        await resume.promise;
        if (!succeeds) {
          throw new Error("Database unavailable");
        }
        await persist(grant, transaction);
      });
      const accept = invitations.accept(user, id);
      await paused.promise;
      const revoke = invitations.revoke(access, id);
      await setImmediate();
      resume.resolve(undefined);

      expect(await accept).toMatchObject({ success: succeeds });
      expect(await revoke).toMatchObject({ success: !succeeds });
      expect(await store.find(id)).toMatchObject({ status: succeeds ? "ACCEPTED" : "REVOKED" });
      expect(harness.findMembership(user.id) !== null).toBe(succeeds);
    },
  );

  it("rejects acceptance when the invitation expires while granting the slot", async () => {
    const { expire, harness, id, invitations, store, transition } = await setup();
    transition.mockImplementationOnce((...args) => {
      expire();
      return store.transition(...args);
    });

    expect(await invitations.accept(user, id)).toMatchObject({ success: false });
    expect(await store.find(id)).toMatchObject({ status: "PENDING" });
    expect(harness.findMembership(user.id)).toBeNull();
    const unchanged = await harness.readTeam();
    expect(unchanged?.members).toEqual([createTestMember({ id: VALID_UUID_2 })]);
  });

  it("rejects a decline that expires after the initial read", async () => {
    const { expire, id, invitations, store, transition } = await setup();
    transition.mockImplementationOnce((...args) => {
      expire();
      return store.transition(...args);
    });

    expect(await invitations.decline(user, id)).toMatchObject({ success: false });
    expect(await store.find(id)).toMatchObject({ status: "PENDING", teamId: VALID_UUID });
  });
});
