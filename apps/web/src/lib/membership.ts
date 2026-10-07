import { prisma } from "@repo/db";

import { log } from "@/lib/observability";
import type { TeamAccess } from "@/lib/team-auth";
import type { TeamMember, TeamRole } from "@/types";

import { type ClaimedSlot, type SlotClaim, teamCommands } from "./team-commands";
import { applyTeamCommand, type TeamContentsFailure, type TeamContentsResult } from "./team-store";

type MembershipGrant = { role: TeamRole; teamId: string; userId: string };
type MembershipRevocation = { memberId: string; teamId: string; userId: string | undefined };

type MembershipStore = {
  /** Creates the membership with `role`, or un-archives an existing one and keeps its role. */
  grant: (grant: MembershipGrant) => Promise<void>;
  /** Revokes the slot's pending invitations and deletes `userId`'s membership unless it is an admin's. */
  revoke: (revocation: MembershipRevocation) => Promise<void>;
};

type MembershipDeps = {
  applyTeamCommand: typeof applyTeamCommand;
  reportError: (event: Parameters<typeof log.error>[0]) => void;
  store: MembershipStore;
};

type RosterGrant = MembershipGrant & {
  /** Persists `grant` in the caller's own transaction, through `membershipUpsert`. */
  commit?: (grant: MembershipGrant, memberId: string) => Promise<void>;
  slot: Omit<SlotClaim, "userId">;
};
type ViewerGrant = MembershipGrant & { slot: null };
type RosterGranted = TeamContentsFailure | { memberId: string; ok: true };
type Revocation = { access: TeamAccess; memberId: string };

const ROUTE = "lib/membership";

const membershipUpsert = ({ role, teamId, userId }: MembershipGrant) => ({
  create: { role, teamId, userId },
  update: { archivedAt: null },
  where: { userId_teamId: { teamId, userId } },
});

const createMembershipLifecycle = (deps: MembershipDeps) => {
  const releaseSlot = async (grant: MembershipGrant, slot: ClaimedSlot): Promise<void> => {
    const event = { memberId: slot.memberId, route: ROUTE, teamId: grant.teamId };
    try {
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
    } catch (error) {
      deps.reportError({ ...event, error, message: "Failed to release a member slot" });
    }
  };

  function grantMembership(request: RosterGrant): Promise<RosterGranted>;
  function grantMembership(request: ViewerGrant): Promise<undefined>;
  async function grantMembership(
    request: RosterGrant | ViewerGrant,
  ): Promise<RosterGranted | undefined> {
    const grant = { role: request.role, teamId: request.teamId, userId: request.userId };
    if (request.slot === null) {
      await deps.store.grant(grant);
      return undefined;
    }

    // The slot lands before access, so no member is ever missing from the admin's roster.
    const claimed = await deps.applyTeamCommand(
      grant.teamId,
      teamCommands.claimMemberSlot({ ...request.slot, userId: grant.userId }),
    );
    if (!claimed.ok) {
      return claimed;
    }

    const slot = claimed.value;
    try {
      await (request.commit ? request.commit(grant, slot.memberId) : deps.store.grant(grant));
    } catch (error) {
      if (slot.claimed) {
        await releaseSlot(grant, slot);
      }
      throw error;
    }

    return { memberId: slot.memberId, ok: true };
  }

  const revokeMembership = async ({
    access,
    memberId,
  }: Revocation): Promise<TeamContentsResult<TeamMember>> => {
    const { teamId } = access;
    const found = await deps.applyTeamCommand(teamId, teamCommands.readMember(memberId));
    if (!found.ok) {
      return found;
    }

    const { userId } = found.value;
    const revokesAccess = userId !== undefined && userId !== "" && userId !== access.user.id;
    // Access goes before the slot, so a failure in between leaves the slot visible to remove again.
    await deps.store.revoke({ memberId, teamId, userId: revokesAccess ? userId : undefined });

    return deps.applyTeamCommand(teamId, teamCommands.removeMember(memberId, userId));
  };

  return { grantMembership, revokeMembership };
};

const prismaMembershipStore: MembershipStore = {
  grant: async (grant) => {
    await prisma.membership.upsert(membershipUpsert(grant));
  },
  revoke: async ({ memberId, teamId, userId }) => {
    const invitations = prisma.invitation.updateMany({
      data: { status: "REVOKED" },
      where: { memberId, status: "PENDING", teamId },
    });

    await (userId === undefined
      ? invitations
      : prisma.$transaction([
          invitations,
          prisma.membership.deleteMany({ where: { role: "MEMBER", teamId, userId } }),
        ]));
  },
};

const { grantMembership, revokeMembership } = createMembershipLifecycle({
  applyTeamCommand,
  reportError: log.error,
  store: prismaMembershipStore,
});

type GrantMembership = typeof grantMembership;
type RevokeMembership = typeof revokeMembership;

export { createMembershipLifecycle, grantMembership, membershipUpsert, revokeMembership };
export type { GrantMembership, MembershipGrant, MembershipStore, RevokeMembership };
