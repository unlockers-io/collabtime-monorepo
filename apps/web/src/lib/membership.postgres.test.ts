// @vitest-environment node
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { type Prisma, prisma } from "@repo/db";
import { afterAll, describe, expect, it, vi } from "vitest";

import { createMockSession, createTestMember, createTestTeamRecord } from "./actions/test-helpers";
import { createInvitations, type InvitationDeps, prismaInvitationStore } from "./invitations";
import { createMembershipLifecycle, prismaMembershipStore } from "./membership";
import type { TeamAccess } from "./team-auth";
import { teamCommands } from "./team-commands";
import { postgresTeamStorage, type TeamStorage } from "./team-storage";
import { createTeamStore } from "./team-store";

type Storage = TeamStorage<Prisma.TransactionClient>;

type Lifecycle = ReturnType<typeof createMembershipLifecycle<Prisma.TransactionClient>>;

const once = () => {
  const paused = Promise.withResolvers<undefined>();
  const resume = Promise.withResolvers<undefined>();
  let pending = true;

  const pause = async () => {
    if (pending) {
      pending = false;
      paused.resolve(undefined);
      await resume.promise;
    }
  };

  return {
    pause,
    paused: paused.promise,
    resume: () => {
      resume.resolve(undefined);
    },
  };
};

const enabled = process.env.MEMBERSHIP_POSTGRES_TESTS === "1";

describe.skipIf(!enabled)("membership transactions against Postgres", () => {
  const users: Array<string> = [];

  const setup = async () => {
    const owner = await prisma.user.create({
      data: { email: `owner-${randomUUID()}@example.com` },
    });

    users.push(owner.id);

    const recipient = await prisma.user.create({
      data: { email: `recipient-${randomUUID()}@example.com` },
    });

    users.push(recipient.id);
    const teamId = randomUUID();
    const memberId = randomUUID();
    await prisma.space.create({ data: { ownerId: owner.id, teamId } });
    const reportError = vi.fn<() => void>();

    const publish = vi.fn<Storage["publish"]>().mockResolvedValue();

    const storeOver = (storage: Partial<Storage> = {}) =>
      createTeamStore({
        createId: randomUUID,
        invalidateTeamName: vi.fn<() => void>(),
        storage: { ...postgresTeamStorage, publish, ...storage },
      });

    const teamStore = storeOver();
    const harness = { ...teamStore, readTeam: teamStore.readTeamRecord, reportError };
    await harness.createTeamContents(
      teamId,
      createTestTeamRecord({ id: teamId, members: [createTestMember({ id: memberId })] }),
    );

    const lifecycle = (
      store = prismaMembershipStore,
      { applyTeamCommand, changeTeamAccess } = teamStore,
    ) => {
      const access = createMembershipLifecycle({ applyTeamCommand, changeTeamAccess, store });

      return {
        ...access,
        revokeMembership: (revocation: { access: TeamAccess; memberId: string }) =>
          applyTeamCommand(
            teamId,
            teamCommands.removeMember(revocation.memberId),
            access.revokeMemberAccess(revocation.access),
          ),
      };
    };

    const membership = lifecycle();
    const transition = vi.fn(prismaInvitationStore.transition);

    const deps: InvitationDeps<Prisma.TransactionClient> = {
      appUrl: () => "https://app.example.com",
      checkRateLimit: () => Promise.resolve({ allowed: true, remaining: 49 }),
      grantMembership: membership.grantMembership,
      isMember: () => Promise.resolve(false),
      notifyInviter: vi.fn<InvitationDeps<Prisma.TransactionClient>["notifyInviter"]>(),
      now: () => new Date(),
      readTeamRecord: harness.readTeam,
      reportError: harness.reportError,
      sendEmail: () => Promise.resolve({ sent: true }),
      store: { ...prismaInvitationStore, transition },
    };

    const service = createInvitations(deps);

    const access = {
      teamId,
      user: createMockSession({ email: owner.email, userId: owner.id }).user,
    };

    const user = createMockSession({ email: recipient.email, userId: recipient.id }).user;
    const invited = await service.invite(access, { email: user.email, memberId });

    if (!invited.success) {
      throw new Error(invited.error);
    }

    const readMembership = () =>
      prisma.membership.findUnique({ where: { userId_teamId: { teamId, userId: user.id } } });

    return {
      access,
      deps,
      harness,
      id: invited.data.invitationId,
      lifecycle,
      memberId,
      membership,
      publish,
      readMembership,
      service,
      storeOver,
      teamId,
      transition,
      user,
    };
  };

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  });

  it("holds a database lock across claim and acceptance, then removes the winning membership", async () => {
    const {
      access,
      deps,
      harness,
      id,
      lifecycle,
      memberId,
      membership,
      readMembership,
      service,
      teamId,
      transition,
      user,
    } = await setup();

    const paused = Promise.withResolvers<undefined>();
    const resume = Promise.withResolvers<undefined>();
    transition.mockImplementationOnce(async (...args) => {
      paused.resolve(undefined);
      await resume.promise;

      return prismaInvitationStore.transition(...args);
    });
    const first = service.accept(user, id);
    await paused.promise;

    try {
      const probe = await prisma.$transaction(
        (transaction) => transaction.$queryRaw<Array<{ available: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtextextended(${`team:${teamId}`}, 0)) AS available
      `,
      );

      expect(probe).toEqual([{ available: false }]);
    } finally {
      resume.resolve(undefined);
    }

    const second = createInvitations({
      ...deps,
      grantMembership: lifecycle().grantMembership,
    }).accept(user, id);

    const outcomes = await Promise.all([first, second]);
    expect(outcomes.filter((outcome) => outcome.success)).toHaveLength(1);
    const team = await harness.readTeam(teamId);
    expect(team?.members).toMatchObject([{ id: memberId, userId: user.id }]);
    expect(await readMembership()).not.toBeNull();

    expect(await membership.revokeMembership({ access, memberId })).toMatchObject({ ok: true });
    const removed = await harness.readTeam(teamId);
    expect(removed?.members).toEqual([]);
    expect(await readMembership()).toBeNull();
  });

  it("keeps a winning acceptance when an earlier transaction times out after claiming", async () => {
    const {
      access,
      deps,
      harness,
      id,
      memberId,
      membership,
      readMembership,
      service,
      teamId,
      user,
    } = await setup();

    const claimed = once();

    const delayed: Lifecycle["grantMembership"] = (grant, slot, first) =>
      membership.grantMembership(grant, slot, async (claimedId, transaction) => {
        await claimed.pause();
        await first?.(claimedId, transaction);
      });

    const losing = createInvitations({ ...deps, grantMembership: delayed }).accept(user, id);

    await claimed.paused;

    try {
      await setTimeout(5200);
      expect(await service.accept(user, id)).toMatchObject({ success: true });
    } finally {
      claimed.resume();
    }

    expect(await losing).toMatchObject({ success: false });
    expect(await readMembership()).not.toBeNull();
    const team = await harness.readTeam(teamId);
    expect(team?.members).toMatchObject([{ id: memberId, userId: user.id }]);
    expect(await membership.revokeMembership({ access, memberId })).toMatchObject({ ok: true });
    expect(await readMembership()).toBeNull();
  }, 15_000);

  it("fences removal after its transaction times out and another server grants access", async () => {
    const {
      access,
      harness,
      id,
      lifecycle,
      memberId,
      membership,
      readMembership,
      service,
      storeOver,
      teamId,
      user,
    } = await setup();

    expect(await service.accept(user, id)).toMatchObject({ success: true });
    const locked = once();

    const delayed = lifecycle(
      prismaMembershipStore,
      storeOver({
        read: async (idToRead, transaction) => {
          await locked.pause();

          return postgresTeamStorage.read(idToRead, transaction);
        },
      }),
    );

    const removing = Promise.allSettled([delayed.revokeMembership({ access, memberId })]);
    await locked.paused;

    try {
      await setTimeout(5200);
      expect(
        await membership.grantMembership(
          { role: "MEMBER", teamId, userId: user.id },
          { memberId, name: "Returning" },
        ),
      ).toMatchObject({ ok: true });
    } finally {
      locked.resume();
    }

    expect(await removing).toMatchObject([
      {
        reason: expect.objectContaining({ message: expect.stringContaining("Transaction") }),
        status: "rejected",
      },
    ]);
    expect(await readMembership()).not.toBeNull();
    const team = await harness.readTeam(teamId);
    expect(team?.members).toMatchObject([{ id: memberId, userId: user.id }]);
  }, 15_000);

  it("never publishes a rolled-back claim and publishes after SQL access is visible", async () => {
    const { harness, memberId, membership, publish, readMembership, teamId, user } = await setup();
    publish.mockImplementation(async () => {
      expect(await readMembership()).not.toBeNull();
      const storedTeam = await harness.readTeam(teamId);
      expect(storedTeam?.members[0]?.userId).toBe(user.id);
    });
    const grant = { role: "MEMBER" as const, teamId, userId: user.id };
    const slot = { memberId, name: "Member" };
    await expect(
      membership.grantMembership(grant, slot, () => Promise.reject(new Error("rollback"))),
    ).rejects.toThrow("rollback");
    expect(publish).not.toHaveBeenCalled();
    expect(await readMembership()).toBeNull();
    const storedTeam = await harness.readTeam(teamId);
    expect(storedTeam?.members[0]?.userId).toBeUndefined();
    expect(await membership.grantMembership(grant, slot)).toMatchObject({ ok: true });
    expect(publish).toHaveBeenCalledOnce();
  });

  it("rolls back a terminated database connection without splitting access and roster", async () => {
    const { harness, memberId, membership, publish, readMembership, teamId, user } = await setup();
    const entered = Promise.withResolvers<number>();
    const resume = Promise.withResolvers<undefined>();

    const grant = { role: "MEMBER" as const, teamId, userId: user.id };

    const writing = Promise.allSettled([
      membership.grantMembership(
        grant,
        { memberId, name: "Member" },
        async (_memberId, transaction) => {
          await prismaMembershipStore.grant(grant, transaction);

          const rows = await transaction.$queryRaw<
            Array<{ pid: number }>
          >`SELECT pg_backend_pid() AS pid`;

          entered.resolve(rows[0]?.pid ?? 0);
          await resume.promise;
          await transaction.$queryRaw`SELECT 1`;
        },
      ),
    ]);

    const pid = await entered.promise;
    expect(pid).toBeGreaterThan(0);
    await prisma.$queryRaw`SELECT pg_terminate_backend(${pid}::integer)`;
    resume.resolve(undefined);
    const results = await writing;
    expect(results[0]?.status).toBe("rejected");
    expect(await readMembership()).toBeNull();
    const rolledBack = await harness.readTeam(teamId);
    expect(rolledBack?.members[0]?.userId).toBeUndefined();
    expect(publish).not.toHaveBeenCalled();
  });

  it("serializes ordinary roster writes with membership transactions", async () => {
    const { harness, memberId, membership, teamId, user } = await setup();
    await Promise.all([
      membership.grantMembership(
        { role: "MEMBER", teamId, userId: user.id },
        { memberId, name: "Member" },
      ),
      harness.applyTeamCommand(teamId, teamCommands.addGroup("Engineering")),
      harness.applyTeamCommand(teamId, teamCommands.renameTeam("Concurrent")),
    ]);
    const team = await harness.readTeam(teamId);
    expect(team).toMatchObject({
      groups: [{ name: "Engineering" }],
      members: [{ id: memberId, userId: user.id }],
      name: "Concurrent",
    });
  });

  it("preserves role and viewer-only membership without a roster slot", async () => {
    const { harness, memberId, membership, teamId, user } = await setup();
    await prisma.membership.create({
      data: { archivedAt: new Date(), role: "ADMIN", teamId, userId: user.id },
    });
    await membership.grantViewerAccess({ role: "MEMBER", teamId, userId: user.id });
    expect(
      await prisma.membership.findUnique({ where: { userId_teamId: { teamId, userId: user.id } } }),
    ).toMatchObject({ archivedAt: null, role: "ADMIN" });
    const storedTeam = await harness.readTeam(teamId);
    expect(storedTeam?.members).toEqual([createTestMember({ id: memberId })]);
  });

  it.each(["accept", "decline"] as const)(
    "checks expiry in the database when %s crosses the deadline",
    async (decision) => {
      const { harness, id, memberId, readMembership, service, teamId, transition, user } =
        await setup();

      await prisma.invitation.update({
        data: { expiresAt: new Date(Date.now() + 250) },
        where: { id },
      });
      transition.mockImplementationOnce(async (...args) => {
        await setTimeout(300);

        return prismaInvitationStore.transition(...args);
      });

      expect(await service[decision](user, id)).toMatchObject({ success: false });
      expect(transition).toHaveBeenCalledOnce();
      expect(await prismaInvitationStore.find(id)).toMatchObject({ status: "PENDING" });
      expect(await readMembership()).toBeNull();
      const team = await harness.readTeam(teamId);
      expect(team?.members).toEqual([createTestMember({ id: memberId })]);
    },
  );

  it.each(["accept", "decline"] as const)(
    "rechecks %s expiry after waiting for an invitation row lock",
    async (decision) => {
      const { id, readMembership, service, user } = await setup();
      await prisma.invitation.update({
        data: { expiresAt: new Date(Date.now() + 400) },
        where: { id },
      });
      const locked = Promise.withResolvers<undefined>();
      const release = Promise.withResolvers<undefined>();

      const holder = prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`SELECT "id" FROM "Invitation" WHERE "id" = ${id} FOR UPDATE`;
        locked.resolve(undefined);
        await release.promise;
      });

      await locked.promise;
      const acceptance = service[decision](user, id);
      await setTimeout(500);
      release.resolve(undefined);
      await holder;

      expect(await acceptance).toMatchObject({ success: false });
      expect(await readMembership()).toBeNull();
      expect(await prismaInvitationStore.find(id)).toMatchObject({ status: "PENDING" });
    },
  );

  it.each([true, false])(
    "holds a concurrent revoke until an acceptance whose membership write succeeds=%s ends",
    async (succeeds) => {
      const { access, deps, id, lifecycle, readMembership, service, user } = await setup();
      const granting = once();

      const slow = lifecycle({
        ...prismaMembershipStore,
        grant: async (grant, transaction) => {
          await granting.pause();

          if (!succeeds) {
            throw new Error("Database unavailable");
          }

          await prismaMembershipStore.grant(grant, transaction);
        },
      });

      const accept = createInvitations({ ...deps, grantMembership: slow.grantMembership }).accept(
        user,
        id,
      );

      await granting.paused;
      const revoke = service.revoke(access, id);
      await setTimeout(200);
      granting.resume();

      expect(await accept).toMatchObject({ success: succeeds });
      expect(await revoke).toMatchObject({ success: !succeeds });
      expect(await prismaInvitationStore.find(id)).toMatchObject({
        status: succeeds ? "ACCEPTED" : "REVOKED",
      });
      expect((await readMembership()) !== null).toBe(succeeds);
    },
  );

  it("rolls back the invitation and claim when membership persistence fails, so a retry claims it", async () => {
    const { harness, id, memberId, readMembership, service, teamId, user } = await setup();

    expect(await service.accept({ ...user, id: "missing-user" }, id)).toEqual({
      error: "Could not update this invitation. Refresh and try again.",
      success: false,
    });
    expect(await prismaInvitationStore.find(id)).toMatchObject({ status: "PENDING" });
    expect(await readMembership()).toBeNull();
    const team = await harness.readTeam(teamId);
    expect(team?.members).toEqual([createTestMember({ id: memberId })]);

    expect(await service.accept(user, id)).toMatchObject({ success: true });
    expect(await readMembership()).toMatchObject({ archivedAt: null, role: "MEMBER" });
  });

  it("keeps legacy invitations open and allows admin management of expired invitations", async () => {
    const { access, id, service, user } = await setup();
    await prisma.invitation.update({ data: { expiresAt: new Date(0) }, where: { id } });
    expect(await service.resend(access, id)).toMatchObject({ success: true });
    await prisma.invitation.update({ data: { expiresAt: new Date(0) }, where: { id } });
    expect(await service.revoke(access, id)).toMatchObject({ success: true });
    await prisma.invitation.update({ data: { expiresAt: null, status: "PENDING" }, where: { id } });
    expect(await service.accept(user, id)).toMatchObject({ success: true });
  });
});
