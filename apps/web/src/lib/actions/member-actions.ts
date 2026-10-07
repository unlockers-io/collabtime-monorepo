"use server";

import { log } from "@/lib/observability";
import { authorizeTeamAdmin, authorizeTeamMember } from "@/lib/team-auth";

import { revokeMembership } from "../membership";

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
  reportError: log.error,
  revokeMembership,
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
