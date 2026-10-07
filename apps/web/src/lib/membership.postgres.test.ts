// @vitest-environment node
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { type Prisma, prisma } from "@repo/db";
import { afterAll, describe, expect, it, vi } from "vitest";

import {
  createMockSession,
  createTestMember,
  createTestTeamRecord,
  createTestTeamStore,
} from "./actions/test-helpers";
import { createInvitations, type InvitationDeps, prismaInvitationStore } from "./invitations";
import { createMembershipLifecycle, prismaMembershipStore } from "./membership";

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
    const harness = createTestTeamStore(randomUUID);
    await harness.seedTeam(
      createTestTeamRecord({ id: teamId, members: [createTestMember({ id: memberId })] }),
    );
    const lifecycle = () =>
      createMembershipLifecycle({
        applyTeamCommand: harness.applyTeamCommand,
        reportError: harness.reportError,
        store: prismaMembershipStore,
      });
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
      readMembership,
      service,
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
        SELECT pg_try_advisory_xact_lock(hashtextextended(${`membership:${teamId}`}, 0)) AS available
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
    const paused = Promise.withResolvers<undefined>();
    const resume = Promise.withResolvers<undefined>();
    let pause = true;
    const applyTeamCommand: typeof harness.applyTeamCommand = async (idToApply, command) => {
      const result = await harness.applyTeamCommand(idToApply, command);
      if (pause) {
        pause = false;
        paused.resolve(undefined);
        await resume.promise;
      }
      return result;
    };
    const delayed = createMembershipLifecycle({
      applyTeamCommand,
      reportError: harness.reportError,
      store: prismaMembershipStore,
    });
    const losing = createInvitations({ ...deps, grantMembership: delayed.grantMembership }).accept(
      user,
      id,
    );
    await paused.promise;
    try {
      await setTimeout(5200);
      expect(await service.accept(user, id)).toMatchObject({ success: true });
    } finally {
      resume.resolve(undefined);
    }

    expect(await losing).toMatchObject({ success: false });
    expect(await readMembership()).not.toBeNull();
    const team = await harness.readTeam(teamId);
    expect(team?.members).toMatchObject([{ id: memberId, userId: user.id }]);
    expect(await membership.revokeMembership({ access, memberId })).toMatchObject({ ok: true });
    expect(await readMembership()).toBeNull();
  }, 15_000);

  it("fences removal after its transaction times out and another server grants access", async () => {
    const { access, harness, id, memberId, membership, readMembership, service, teamId, user } =
      await setup();
    expect(await service.accept(user, id)).toMatchObject({ success: true });
    const paused = Promise.withResolvers<undefined>();
    const resume = Promise.withResolvers<undefined>();
    let calls = 0;
    const applyTeamCommand: typeof harness.applyTeamCommand = async (idToApply, command) => {
      calls += 1;
      if (calls === 2) {
        paused.resolve(undefined);
        await resume.promise;
      }
      return harness.applyTeamCommand(idToApply, command);
    };
    const delayed = createMembershipLifecycle({
      applyTeamCommand,
      reportError: harness.reportError,
      store: prismaMembershipStore,
    });
    const removing = Promise.allSettled([delayed.revokeMembership({ access, memberId })]);
    await paused.promise;
    try {
      await setTimeout(5200);
      expect(
        await membership.grantMembership({
          role: "MEMBER",
          slot: { memberId, name: "Returning" },
          teamId,
          userId: user.id,
        }),
      ).toMatchObject({ ok: true });
    } finally {
      resume.resolve(undefined);
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

  it("rolls back the invitation and claim when membership persistence fails", async () => {
    const { harness, id, memberId, readMembership, service, teamId, user } = await setup();

    expect(await service.accept({ ...user, id: "missing-user" }, id)).toMatchObject({
      success: false,
    });
    expect(await prismaInvitationStore.find(id)).toMatchObject({ status: "PENDING" });
    expect(await readMembership()).toBeNull();
    const team = await harness.readTeam(teamId);
    expect(team?.members).toEqual([createTestMember({ id: memberId })]);
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
