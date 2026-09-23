"use server";

import { prisma } from "@repo/db";
import { updateTag } from "next/cache";
import { v4 as uuidv4 } from "uuid";

import { log } from "@/lib/observability";
import { authorizeTeamAdmin, authorizeTeamMember } from "@/lib/team-auth";
import { teamNameTag } from "@/lib/team-meta";

import { claimOrCreateMemberSlot } from "../team-slots";
import { readTeamRecord } from "../team-store";

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
  claimOrCreateSlot: claimOrCreateMemberSlot,
  createId: uuidv4,
  mutateTeam,
  readTeam: readTeamRecord,
  removeMembershipForSlot: async (teamId, userId, callerUserId) => {
    if (userId !== callerUserId) {
      await prisma.membership.deleteMany({ where: { role: "MEMBER", teamId, userId } });
    }
  },
  reportError: log.error,
  revalidateTeamName: (teamId) => {
    updateTag(teamNameTag(teamId));
  },
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
