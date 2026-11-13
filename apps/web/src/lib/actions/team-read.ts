"use server";

import { getSession } from "@/lib/auth-server";
import { log } from "@/lib/observability";
import { canViewTeam, findTeamSpace } from "@/lib/team-auth";

import { readPublicTeam } from "../public-team";

import { createTeamReadActions } from "./team-read-core";

const teamReadActions = createTeamReadActions({
  canViewTeam,
  findSpace: findTeamSpace,
  getSession,
  readPublicTeam,
  reportError: log.error,
});

const getPublicTeam = teamReadActions.getPublicTeam;

export { getPublicTeam };
