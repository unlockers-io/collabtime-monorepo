import type { Prisma } from "@repo/db";

import type { TeamAccess } from "@/lib/team-auth";
import type { TeamMember, TeamRole } from "@/types";

import { type SlotClaim, teamCommands } from "./team-commands";
import {
  type AccessChange,
  applyTeamCommand,
  type ApplyTeamCommand,
  changeTeamAccess,
  type TeamContentsFailure,
} from "./team-store";

type MembershipGrant = { role: TeamRole; teamId: string; userId: string };

type MembershipRevocation = { memberId: string; teamId: string; userId: string | undefined };

type MembershipStore<TTransaction> = {
  /** Creates access or un-archives it, preserving the existing role. */
  grant: (grant: MembershipGrant, transaction: TTransaction) => Promise<void>;
  revoke: (revocation: MembershipRevocation, transaction: TTransaction) => Promise<void>;
};

type MembershipDeps<TTransaction> = {
  applyTeamCommand: ApplyTeamCommand<TTransaction>;
  changeTeamAccess: (
    teamId: string,
    change: (transaction: TTransaction) => Promise<void>,
  ) => Promise<void>;
  store: MembershipStore<TTransaction>;
};

type RosterGranted = TeamContentsFailure | { memberId: string; ok: true };

const membershipUpsert = ({ role, teamId, userId }: MembershipGrant) => ({
  create: { role, teamId, userId },
  update: { archivedAt: null },
  where: { userId_teamId: { teamId, userId } },
});

const createMembershipLifecycle = <TTransaction>(deps: MembershipDeps<TTransaction>) => {
  /** `first` settles what the grant answers, such as an invitation, in the same transaction. */
  const grantMembership = async (
    grant: MembershipGrant,
    slot: Omit<SlotClaim, "userId">,
    first?: (memberId: string, transaction: TTransaction) => Promise<void>,
  ): Promise<RosterGranted> => {
    const claimed = await deps.applyTeamCommand(
      grant.teamId,
      teamCommands.claimMemberSlot({ ...slot, userId: grant.userId }),
      async ({ memberId }, transaction) => {
        await first?.(memberId, transaction);
        await deps.store.grant(grant, transaction);
      },
    );

    return claimed.ok ? { memberId: claimed.value.memberId, ok: true } : claimed;
  };

  /** Password viewers get access without a roster slot. */
  const grantViewerAccess = (grant: MembershipGrant): Promise<void> =>
    deps.changeTeamAccess(grant.teamId, (transaction) => deps.store.grant(grant, transaction));

  /** Removing your own slot keeps your membership. */
  const revokeMemberAccess =
    ({ teamId, user }: TeamAccess): AccessChange<TeamMember, TTransaction> =>
    ({ id, userId }, transaction) =>
      deps.store.revoke(
        { memberId: id, teamId, userId: userId === user.id ? undefined : userId },
        transaction,
      );

  return { grantMembership, grantViewerAccess, revokeMemberAccess };
};

const prismaMembershipStore: MembershipStore<Prisma.TransactionClient> = {
  grant: async (grant, transaction) => {
    await transaction.membership.upsert(membershipUpsert(grant));
  },
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

const { grantMembership, grantViewerAccess, revokeMemberAccess } = createMembershipLifecycle({
  applyTeamCommand,
  changeTeamAccess,
  store: prismaMembershipStore,
});

type GrantMembership<TTransaction> = ReturnType<
  typeof createMembershipLifecycle<TTransaction>
>["grantMembership"];

export {
  createMembershipLifecycle,
  grantMembership,
  grantViewerAccess,
  membershipUpsert,
  prismaMembershipStore,
  revokeMemberAccess,
};

export type { GrantMembership, MembershipStore };
