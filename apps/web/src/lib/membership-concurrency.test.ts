import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createTestAccess,
  createTestMember,
  createTestTeamRecord,
  createTestTeamStore,
  VALID_UUID,
  VALID_UUID_2,
} from "./actions/test-helpers";
import { createMembershipLifecycle, type MembershipStore } from "./membership";

const access = createTestAccess();
const request = {
  role: "MEMBER" as const,
  slot: { memberId: VALID_UUID_2, name: "Bob" },
  teamId: VALID_UUID,
  userId: "bob",
};

const setup = async () => {
  const harness = createTestTeamStore(randomUUID);
  await harness.seedTeam(
    createTestTeamRecord({ members: [createTestMember({ id: VALID_UUID_2 })] }),
  );
  return harness;
};

const lifecycle = (
  harness: ReturnType<typeof createTestTeamStore>,
  store: MembershipStore<undefined>,
) =>
  createMembershipLifecycle({
    applyTeamCommand: harness.applyTeamCommand,
    reportError: harness.reportError,
    store,
  });

describe("membership operation interleavings", () => {
  it("waits for a granting operation before revoking its access and roster slot", async () => {
    const harness = await setup();
    const paused = Promise.withResolvers<undefined>();
    const resume = Promise.withResolvers<undefined>();
    const first = lifecycle(harness, {
      ...harness.membershipStore,
      grant: async (grant, transaction) => {
        paused.resolve(undefined);
        await resume.promise;
        await harness.membershipStore.grant(grant, transaction);
      },
    });
    const grant = first.grantMembership(request);
    await paused.promise;
    const revoke = harness.revokeMembership({ access, memberId: VALID_UUID_2 });
    resume.resolve(undefined);

    expect(await grant).toMatchObject({ ok: true });
    expect(await revoke).toMatchObject({ ok: true });
    expect(harness.findMembership("bob")).toBeNull();
    const team = await harness.readTeam();
    expect(team?.members).toEqual([]);
  });

  it("keeps access and the adopted slot when a grant lands between revocation commit and removal", async () => {
    const harness = await setup();
    await harness.grantMembership(request);
    let regrant = true;
    const lock: MembershipStore<undefined>["lock"] = async (teamId, run) => {
      const result = await harness.membershipStore.lock(teamId, run);
      if (regrant) {
        regrant = false;
        await harness.grantMembership(request);
      }
      return result;
    };
    const remover = lifecycle(harness, { ...harness.membershipStore, lock });

    expect(await remover.revokeMembership({ access, memberId: VALID_UUID_2 })).toMatchObject({
      ok: false,
    });
    expect(harness.findMembership("bob")).not.toBeNull();
    const team = await harness.readTeam();
    expect(team?.members).toMatchObject([{ id: VALID_UUID_2, userId: "bob" }]);
    expect(await harness.revokeMembership({ access, memberId: VALID_UUID_2 })).toMatchObject({
      ok: true,
    });
    expect(harness.findMembership("bob")).toBeNull();
  });

  it("does not compensate a database commit whose successful response was lost", async () => {
    const harness = await setup();
    let loseResponse = true;
    const lock: MembershipStore<undefined>["lock"] = async (teamId, run) => {
      const result = await harness.membershipStore.lock(teamId, run);
      if (loseResponse) {
        loseResponse = false;
        throw new Error("Connection lost after commit");
      }
      return result;
    };
    const failing = lifecycle(harness, { ...harness.membershipStore, lock });

    await expect(failing.grantMembership(request)).rejects.toThrow("Connection lost after commit");
    expect(harness.findMembership("bob")).not.toBeNull();
    const team = await harness.readTeam();
    expect(team?.members).toMatchObject([{ id: VALID_UUID_2, userId: "bob" }]);
    expect(await harness.revokeMembership({ access, memberId: VALID_UUID_2 })).toMatchObject({
      ok: true,
    });
    expect(harness.findMembership("bob")).toBeNull();
  });
});
