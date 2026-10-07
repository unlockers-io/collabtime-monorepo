"use server";

import { prisma } from "@repo/db";

import { log } from "@/lib/observability";
import { authorizeTeamAdmin, authorizeTeamMember } from "@/lib/team-auth";

import { mutateTeam } from "./helpers";
import { createMemberActions } from "./member-actions-core";

const {
  addMember,
  createOwnMemberSlot,
  importMembers,
  removeMember,
  reorderMembers,
  updateMember,
  updateOwnMember,
  updateTeamName,
} = createMemberActions({
  authorizeTeamAdmin,
  authorizeTeamMember,
  mutateTeam,
  removeMembership: async (teamId, userId) => {
    await prisma.membership.deleteMany({ where: { role: "MEMBER", teamId, userId } });
  },
  reportError: log.error,
  revokeInvitationsForMember: async (teamId, memberId) => {
    await prisma.invitation.updateMany({
      data: { status: "REVOKED" },
      where: { memberId, status: "PENDING", teamId },
    });
  },
});

export {
  createOwnMemberSlot,
  addMember,
  importMembers,
  removeMember,
  reorderMembers,
  updateMember,
  updateOwnMember,
  updateTeamName,
};
