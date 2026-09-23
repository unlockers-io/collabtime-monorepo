"use server";

import { prisma } from "@repo/db";
import { after } from "next/server";

import { getAppUrl } from "../app-url";
import { inviteLink, openInvitationWhere } from "../invitations";
import { sendAppEmail } from "../mailer";
import { log } from "../observability";
import { checkRateLimit } from "../space-rate-limit";
import { authenticate, authorizeTeamAdmin } from "../team-auth";
import { teamNotifier } from "../team-notifier";
import { claimOrCreateMemberSlot } from "../team-slots";
import { readTeamRecord } from "../team-store";

import { createInvitationActions } from "./invitation-actions-core";
import type { InvitationDeps, InvitationRecord } from "./invitation-deps";
import { createInvitationManagementActions } from "./invitation-management-core";

const pendingVersion = (invitation: InvitationRecord) => ({
  id: invitation.id,
  status: "PENDING" as const,
  updatedAt: invitation.updatedAt,
});
const include = { invitedBy: { select: { email: true, name: true } } };
const deps: InvitationDeps = {
  authenticate,
  authorizeTeamAdmin,
  checkRateLimit,
  claimOrCreateSlot: claimOrCreateMemberSlot,
  commitAcceptance: async (invitation, memberId, userId) => {
    const open = openInvitationWhere(new Date());
    await prisma.$transaction([
      prisma.invitation.update({
        data: { memberId, status: "ACCEPTED" },
        where: { ...pendingVersion(invitation), ...open },
      }),
      prisma.membership.upsert({
        create: { role: "MEMBER", teamId: invitation.teamId, userId },
        update: { archivedAt: null },
        where: { userId_teamId: { teamId: invitation.teamId, userId } },
      }),
    ]);
  },
  findInvitation: (id) => prisma.invitation.findUnique({ include, where: { id } }),
  inviteLink: (teamId, id) => inviteLink(getAppUrl(), teamId, id),
  listPendingForTeam: (teamId) =>
    prisma.invitation.findMany({
      include,
      orderBy: { createdAt: "desc" },
      where: { status: "PENDING", teamId },
    }),
  loadInviteContext: async (teamId, email) => {
    const [team, membership] = await Promise.all([
      readTeamRecord(teamId),
      prisma.membership.findFirst({ where: { teamId, user: { email } } }),
    ]);
    return { existingMembership: membership !== null, team };
  },
  markDeclined: async (invitation) => {
    await prisma.invitation.update({
      data: { status: "DECLINED" },
      where: { ...pendingVersion(invitation), ...openInvitationWhere(new Date()) },
    });
  },
  markRevoked: async (invitation) => {
    await prisma.invitation.update({
      data: { status: "REVOKED" },
      where: pendingVersion(invitation),
    });
  },
  notifyInviter: (invitation, user, decision) => {
    after(() => teamNotifier.notifyInviterOfDecision(invitation, user, decision));
  },
  now: () => new Date(),
  refreshExpiry: async (invitation, expiresAt) => {
    await prisma.invitation.update({ data: { expiresAt }, where: pendingVersion(invitation) });
  },
  reportError: log.error,
  sendEmail: sendAppEmail,
  upsertInvitation: (input) =>
    prisma.invitation.upsert({
      create: input,
      include,
      update: { ...input, status: "PENDING" },
      where: { email_teamId: { email: input.email, teamId: input.teamId } },
    }),
};
const { acceptInvitation, declineInvitation, inviteMember } = createInvitationActions(deps);
const { getPendingTeamInvitations, resendInvitation, revokeInvitation } =
  createInvitationManagementActions(deps);
export {
  acceptInvitation,
  declineInvitation,
  getPendingTeamInvitations,
  inviteMember,
  resendInvitation,
  revokeInvitation,
};
