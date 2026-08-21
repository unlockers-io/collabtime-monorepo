"use server";

import { prisma } from "@repo/db";
import { cookies } from "next/headers";

import { getSession } from "@/lib/auth-server";
import { log } from "@/lib/observability";
import { verifySpaceAccessToken } from "@/lib/space-access";
import { getTeamRole } from "@/lib/team-auth";

import { readTeamRecord } from "../team-store";

import { createTeamReadActions } from "./team-read-core";

const teamReadActions = createTeamReadActions({
  findSpace: (teamId) =>
    prisma.space.findUnique({
      select: { accessPassword: true, id: true, isPrivate: true },
      where: { teamId },
    }),
  getAccessToken: async (cookieName) => {
    const cookieStore = await cookies();
    return cookieStore.get(cookieName)?.value;
  },
  getSession,
  getTeamRole,
  readTeamRecord,
  reportError: log.error,
  verifyAccessToken: (token, spaceId, accessPassword) =>
    verifySpaceAccessToken(token, spaceId, accessPassword).valid,
});

const getPublicTeam = teamReadActions.getPublicTeam;
const getTeamMembershipRole = teamReadActions.getTeamMembershipRole;

export { getPublicTeam, getTeamMembershipRole };
