"use server";

import { updateTag } from "next/cache";
import { v4 as uuidv4 } from "uuid";

import { log } from "@/lib/observability";
import { requireAuth, requireTeamMember } from "@/lib/team-auth";
import { teamNameTag } from "@/lib/team-meta";
import type { Team } from "@/types";

import { mutateTeam } from "./helpers";
import { createMemberActions } from "./member-actions-core";
import type { ActionResult } from "./types";

const memberActions = createMemberActions({
  createId: uuidv4,
  mutateTeam,
  reportError: log.error,
  requireAuth,
  requireTeamMember,
});

const { addMember, importMembers, removeMember, reorderMembers, updateMember, updateOwnMember } =
  memberActions;

const updateTeamName = async (teamId: string, name: string): Promise<ActionResult<Team>> => {
  const result = await memberActions.updateTeamName(teamId, name);

  if (result.success) {
    updateTag(teamNameTag(teamId));
  }

  return result;
};

export {
  addMember,
  importMembers,
  removeMember,
  reorderMembers,
  updateMember,
  updateOwnMember,
  updateTeamName,
};
