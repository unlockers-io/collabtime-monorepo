"use server";

import { log } from "@/lib/observability";
import { authorizeTeamAdmin, authorizeTeamMember } from "@/lib/team-auth";

import { revokeMembership } from "../membership";
import { applyTeamCommand } from "../team-store";

import { createTeamChangeAction } from "./team-change-core";

const changeTeam = createTeamChangeAction({
  applyTeamCommand,
  authorizeTeamAdmin,
  authorizeTeamMember,
  reportError: log.error,
  revokeMembership,
});

export { changeTeam };
