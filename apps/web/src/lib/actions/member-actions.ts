"use server";

import { v4 as uuidv4 } from "uuid";

import { log } from "@/lib/observability";
import { requireAuth, requireTeamMember } from "@/lib/team-auth";

import { mutateTeam } from "./helpers";
import { createMemberActions } from "./member-actions-core";

const memberActions = createMemberActions({
  createId: uuidv4,
  mutateTeam,
  reportError: log.error,
  requireAuth,
  requireTeamMember,
});

const {
  addMember,
  importMembers,
  removeMember,
  reorderMembers,
  updateMember,
  updateOwnMember,
  updateTeamName,
} = memberActions;

export {
  addMember,
  importMembers,
  removeMember,
  reorderMembers,
  updateMember,
  updateOwnMember,
  updateTeamName,
};
