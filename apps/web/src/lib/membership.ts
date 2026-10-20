import type { Prisma } from "@repo/db";

import type { TeamAccess } from "@/lib/team-auth";
import type { TeamMember, TeamRole } from "@/types";

import { type SlotClaim, teamCommands } from "./team-commands";
import { publishTeamEvent } from "./team-events";
import { withTeamTransaction } from "./team-storage";
import {
  applyInTransaction,
  type ApplyTeamCommand,
  type TeamContentsFailure,
  type TeamContentsResult,
} from "./team-store";

type MembershipGrant = { role: TeamRole; teamId: string; userId: string };
type MembershipRevocation = { memberId: string; teamId: string; userId: string | undefined };

type MembershipStore<TTransaction> = {
  /** Creates access or un-archives it, preserving the existing role. */
  grant: (grant: MembershipGrant, transaction: TTransaction) => Promise<void>;
  /** Serializes team membership operations across servers; all database writes use this transaction. */
  lock: <T>(teamId: string, run: (transaction: TTransaction) => Promise<T>) => Promise<T>;
  revoke: (revocation: MembershipRevocation, transaction: TTransaction) => Promise<void>;
};

type MembershipDeps<TTransaction> = {
  applyTeamCommand: ApplyTeamCommand<TTransaction>;
  publish: (teamId: string) => Promise<void>;
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

const membershipUpsert = ({ role, teamId, userId }: MembershipGrant) => ({
  create: { role, teamId, userId },
  update: { archivedAt: null },
  where: { userId_teamId: { teamId, userId } },
});

const createMembershipLifecycle = <TTransaction>(deps: MembershipDeps<TTransaction>) => {
  function grantMembership(request: RosterGrant<TTransaction>): Promise<RosterGranted>;
  function grantMembership(request: ViewerGrant): Promise<undefined>;
  async function grantMembership(
    request: RosterGrant<TTransaction> | ViewerGrant,
  ): Promise<RosterGranted | undefined> {
    const grant = { role: request.role, teamId: request.teamId, userId: request.userId };
    const result = await deps.store.lock(grant.teamId, async (transaction) => {
      if (request.slot === null) {
        await deps.store.grant(grant, transaction);
        return undefined;
      }
      const claimed = await deps.applyTeamCommand(
        grant.teamId,
        teamCommands.claimMemberSlot({ ...request.slot, userId: grant.userId }),
        transaction,
      );
      if (!claimed.ok) {
        return claimed;
      }
      await (request.commit
        ? request.commit(grant, claimed.value.memberId, transaction)
        : deps.store.grant(grant, transaction));
      return { memberId: claimed.value.memberId, ok: true as const };
    });
    if (result === undefined || result.ok) {
      await deps.publish(grant.teamId);
    }
    return result;
  }

  const revokeMembership = async ({
    access,
    memberId,
  }: Revocation): Promise<TeamContentsResult<TeamMember>> => {
    const { teamId } = access;
    const result = await deps.store.lock(teamId, async (transaction) => {
      const found = await deps.applyTeamCommand(
        teamId,
        teamCommands.removeMember(memberId),
        transaction,
      );
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
    if (result.ok) {
      await deps.publish(teamId);
    }
    return result;
  };

  return { grantMembership, revokeMembership };
};

const prismaMembershipStore: MembershipStore<Prisma.TransactionClient> = {
  grant: async (grant, transaction) => {
    await transaction.membership.upsert(membershipUpsert(grant));
  },
  lock: withTeamTransaction,
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
  applyTeamCommand: applyInTransaction,
  publish: (teamId) => publishTeamEvent(teamId, "space"),
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
