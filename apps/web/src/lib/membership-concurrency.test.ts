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
import { teamCommands } from "./team-commands";
import type { ApplyTeamCommand } from "./team-store";

const access = createTestAccess();
const bob = { role: "MEMBER" as const, teamId: VALID_UUID, userId: "bob" };
const slot = { memberId: VALID_UUID_2, name: "Bob" };

const setup = async () => {
  const harness = createTestTeamStore(randomUUID);
  await harness.seedTeam(
    createTestTeamRecord({ members: [createTestMember({ id: VALID_UUID_2 })] }),
  );

  return harness;
};

type Harness = ReturnType<typeof createTestTeamStore>;

const lifecycle = (
  harness: Harness,
  store: MembershipStore<undefined>,
  applyTeamCommand: ApplyTeamCommand<undefined> = harness.applyTeamCommand,
) =>
  createMembershipLifecycle({
    applyTeamCommand,
    changeTeamAccess: harness.changeTeamAccess,
    store,
  });

/** Runs `after` once, right after the first command commits. */
const afterFirstCommit = (harness: Harness, after: () => Promise<void>) => {
  let pending = true;

  const applyTeamCommand: ApplyTeamCommand<undefined> = async (teamId, command, changeAccess) => {
    const result = await harness.applyTeamCommand(teamId, command, changeAccess);

    if (pending) {
      pending = false;
      await after();
    }

    return result;
  };

  return applyTeamCommand;
};

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

    const grant = first.grantMembership(bob, slot);
    await paused.promise;
    const revoke = harness.revokeMembership({ access, memberId: VALID_UUID_2 });
    resume.resolve(undefined);

    expect(await grant).toMatchObject({ ok: true });
    expect(await revoke).toMatchObject({ ok: true });
    expect(harness.findMembership("bob")).toBeNull();
    const team = await harness.readTeam();
    expect(team?.members).toEqual([]);
  });

  it("serializes a regrant after the complete revocation", async () => {
    const harness = await setup();
    await harness.grantMembership(bob, slot);

    const applyTeamCommand = afterFirstCommit(harness, async () => {
      await harness.grantMembership(bob, slot);
    });

    expect(
      await applyTeamCommand(
        VALID_UUID,
        teamCommands.removeMember(VALID_UUID_2),
        harness.revokeMemberAccess(access),
      ),
    ).toMatchObject({ ok: true });
    expect(harness.findMembership("bob")).not.toBeNull();
    const team = await harness.readTeam();
    expect(team?.members).toMatchObject([{ userId: "bob" }]);
    expect(
      await harness.revokeMembership({ access, memberId: team?.members[0]?.id ?? "missing" }),
    ).toMatchObject({ ok: true });
    expect(harness.findMembership("bob")).toBeNull();
  });

  it("does not compensate a database commit whose successful response was lost", async () => {
    const harness = await setup();

    const failing = lifecycle(
      harness,
      harness.membershipStore,
      afterFirstCommit(harness, () => Promise.reject(new Error("Connection lost after commit"))),
    );

    await expect(failing.grantMembership(bob, slot)).rejects.toThrow(
      "Connection lost after commit",
    );
    expect(harness.findMembership("bob")).not.toBeNull();
    const team = await harness.readTeam();
    expect(team?.members).toMatchObject([{ userId: "bob" }]);
    expect(await harness.revokeMembership({ access, memberId: VALID_UUID_2 })).toMatchObject({
      ok: true,
    });
    expect(harness.findMembership("bob")).toBeNull();
  });
});
