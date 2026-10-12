import { type Prisma, prisma } from "@repo/db";

import { log } from "@/lib/observability";
import type { TeamAccess } from "@/lib/team-auth";
import type { TeamMember, TeamRole } from "@/types";

import { type ClaimedSlot, type SlotClaim, teamCommands } from "./team-commands";
import { applyTeamCommand, type TeamContentsFailure, type TeamContentsResult } from "./team-store";

type MembershipGrant = { role: TeamRole; teamId: string; userId: string };
type MembershipRevocation = { memberId: string; teamId: string; userId: string | undefined };

type MembershipStore<TTransaction> = {
  find: (
    teamId: string,
    userId: string,
    transaction: TTransaction,
  ) => Promise<{ role: TeamRole } | null>;
  /** Creates access or un-archives it, preserving the existing role. */
  grant: (grant: MembershipGrant, transaction: TTransaction) => Promise<void>;
  /** Serializes team membership operations across servers; all database writes use this transaction. */
  lock: <T>(teamId: string, run: (transaction: TTransaction) => Promise<T>) => Promise<T>;
  revoke: (revocation: MembershipRevocation, transaction: TTransaction) => Promise<void>;
};

type MembershipDeps<TTransaction> = {
  applyTeamCommand: typeof applyTeamCommand;
  reportError: (event: Parameters<typeof log.error>[0]) => void;
  store: MembershipStore<TTransaction>;
};

type RosterGrant<TTransaction> = MembershipGrant & {
  /** Persists the status change and membership in the supplied transaction. */
  commit?: (grant: MembershipGrant, memberId: string, transaction: TTransaction) => Promise<void>;
  slot: Omit<SlotClaim, "userId">;
};
type ViewerGrant = MembershipGrant & { slot: null };
type RosterGranted = TeamContentsFailure | { memberId: string; ok: true };
type Revocation = { access: TeamAccess; memberId: string };

const ROUTE = "lib/membership";
const changed = (): TeamContentsFailure => ({
  error: "This member changed while saving. Try again.",
  ok: false,
  reason: "conflict",
});

const membershipUpsert = ({ role, teamId, userId }: MembershipGrant) => ({
  create: { role, teamId, userId },
  update: { archivedAt: null },
  where: { userId_teamId: { teamId, userId } },
});

const createMembershipLifecycle = <TTransaction>(deps: MembershipDeps<TTransaction>) => {
  const releaseSlot = async (grant: MembershipGrant, slot: ClaimedSlot): Promise<void> => {
    const event = { memberId: slot.memberId, route: ROUTE, teamId: grant.teamId };
    try {
      // A failed/uncertain commit must not undo access committed by this or another operation.
      await deps.store.lock(grant.teamId, async (transaction) => {
        if (await deps.store.find(grant.teamId, grant.userId, transaction)) {
          return;
        }
        const released = await deps.applyTeamCommand(
          grant.teamId,
          teamCommands.releaseMemberSlot(slot, grant.userId),
        );
        if (!released.ok) {
          deps.reportError({
            ...event,
            message: "Failed to release a member slot",
            reason: released.reason,
          });
        }
      });
    } catch (error) {
      deps.reportError({ ...event, error, message: "Failed to release a member slot" });
    }
  };

  function grantMembership(request: RosterGrant<TTransaction>): Promise<RosterGranted>;
  function grantMembership(request: ViewerGrant): Promise<undefined>;
  async function grantMembership(
    request: RosterGrant<TTransaction> | ViewerGrant,
  ): Promise<RosterGranted | undefined> {
    const grant = { role: request.role, teamId: request.teamId, userId: request.userId };
    let claimed: ClaimedSlot | undefined;
    try {
      return await deps.store.lock(grant.teamId, async (transaction) => {
        if (request.slot === null) {
          await deps.store.grant(grant, transaction);
          return undefined;
        }
        // Claim before granting access; a crash can leave a visible slot, never invisible access.
        const result = await deps.applyTeamCommand(
          grant.teamId,
          teamCommands.claimMemberSlot({ ...request.slot, userId: grant.userId }),
        );
        if (!result.ok) {
          return result;
        }
        claimed = result.value;
        await (request.commit
          ? request.commit(grant, claimed.memberId, transaction)
          : deps.store.grant(grant, transaction));
        return { memberId: claimed.memberId, ok: true };
      });
    } catch (error) {
      if (claimed?.claimed === true) {
        await releaseSlot(grant, claimed);
      }
      throw error;
    }
  }

  const revokeMembership = async ({
    access,
    memberId,
  }: Revocation): Promise<TeamContentsResult<TeamMember>> => {
    const { teamId } = access;
    const revoked = await deps.store.lock(teamId, async (transaction) => {
      const found = await deps.applyTeamCommand(teamId, teamCommands.readMember(memberId));
      if (!found.ok) {
        return found;
      }
      const { userId } = found.value;
      await deps.store.revoke(
        { memberId, teamId, userId: userId === access.user.id ? undefined : userId },
        transaction,
      );
      return found;
    });
    if (!revoked.ok) {
      return revoked;
    }

    // Access deletion must commit before removal, so a transaction rollback keeps the roster visible.
    return deps.store.lock(teamId, async (transaction) => {
      const member = revoked.value;
      if (member.userId !== undefined && member.userId !== "" && member.userId !== access.user.id) {
        const membership = await deps.store.find(teamId, member.userId, transaction);
        if (membership?.role === "MEMBER") {
          return changed();
        }
      }
      return deps.applyTeamCommand(
        teamId,
        teamCommands.removeMember(memberId, member.userId, member.membershipRevision),
      );
    });
  };

  return { grantMembership, revokeMembership };
};

const prismaMembershipStore: MembershipStore<Prisma.TransactionClient> = {
  find: (teamId, userId, transaction) =>
    transaction.membership.findUnique({
      select: { role: true },
      where: { userId_teamId: { teamId, userId } },
    }),
  grant: async (grant, transaction) => {
    await transaction.membership.upsert(membershipUpsert(grant));
  },
  lock: (teamId, run) =>
    prisma.$transaction(async (transaction) => {
      // The database holds this lock until commit/rollback, including on another server or process death.
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`membership:${teamId}`}, 0))`;
      return run(transaction);
    }),
  revoke: async ({ memberId, teamId, userId }, transaction) => {
    await transaction.invitation.updateMany({
      data: { status: "REVOKED" },
      where: { memberId, status: "PENDING", teamId },
    });
    if (userId !== undefined) {
      await transaction.membership.deleteMany({ where: { role: "MEMBER", teamId, userId } });
    }
  },
};

const { grantMembership, revokeMembership } = createMembershipLifecycle({
  applyTeamCommand,
  reportError: log.error,
  store: prismaMembershipStore,
});

type GrantMembership<TTransaction = unknown> = ReturnType<
  typeof createMembershipLifecycle<TTransaction>
>["grantMembership"];
type RevokeMembership = typeof revokeMembership;

export {
  createMembershipLifecycle,
  grantMembership,
  membershipUpsert,
  prismaMembershipStore,
  revokeMembership,
};
export type { GrantMembership, MembershipGrant, MembershipStore, RevokeMembership };
