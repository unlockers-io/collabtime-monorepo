"use server";

import { log } from "@/lib/observability";
import { authorizeTeamAdmin, authorizeTeamMember } from "@/lib/team-auth";

import { revokeMemberAccess } from "../membership";
import { applyTeamCommand } from "../team-store";

import { createTeamChangeAction } from "./team-change-core";

const changeTeam = createTeamChangeAction({
  accessChanges: { removeMember: revokeMemberAccess },
  applyTeamCommand,
  authorizeTeamAdmin,
  authorizeTeamMember,
  reportError: log.error,
});

export { changeTeam };
