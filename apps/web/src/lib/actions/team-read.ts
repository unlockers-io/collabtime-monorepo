"use server";

import { prisma } from "@repo/db";

import { getSession } from "@/lib/auth-server";
import { log } from "@/lib/observability";
import { workspaceAccessStore } from "@/lib/workspace-access";

import { readTeamRecord } from "../team-store";

import { createTeamReadActions } from "./team-read-core";

const teamReadActions = createTeamReadActions({
  accessStore: workspaceAccessStore,
  findSpace: (teamId) =>
    prisma.space.findUnique({
      select: { accessPassword: true, id: true, isPrivate: true, teamId: true },
      where: { teamId },
    }),
  getSession,
  readTeamRecord,
  reportError: log.error,
});

const getPublicTeam = teamReadActions.getPublicTeam;

export { getPublicTeam };
