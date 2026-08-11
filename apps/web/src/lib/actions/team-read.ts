"use server";

import { prisma } from "@repo/db";
import { cookies } from "next/headers";
import { cache } from "react";

import { getSession } from "@/lib/auth-server";
import { log } from "@/lib/observability";
import { SPACE_ACCESS_COOKIE_PREFIX, verifySpaceAccessToken } from "@/lib/space-access";
import { getTeamRole } from "@/lib/team-auth";
import type { Team, TeamRole } from "@/types";

import { readTeamRecord, readTeamSummary } from "../team-store";
import { UUIDSchema } from "../validation";

import { sanitizeTeam } from "./helpers";
import type { ActionResult } from "./types";

const getTeamMembershipRole = async (teamId: string): Promise<TeamRole | null> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return null;
    }

    const result = await getTeamRole(teamId);

    return result?.role ?? null;
  } catch (error) {
    log.error({ error, message: "Failed to get membership role", route: "actions/team-read" });
    return null;
  }
};

const getPublicTeam = async (teamId: string): Promise<ActionResult<{ team: Team }>> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { error: "Invalid team ID", success: false };
    }

    const space = await prisma.space.findUnique({
      where: { teamId },
    });

    if (!space) {
      return { error: "Team not found", success: false };
    }

    const session = await getSession();
    const userId = session?.user?.id;

    if (space.isPrivate) {
      const memberRole = await getTeamMembershipRole(teamId);
      if (!memberRole) {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get(`${SPACE_ACCESS_COOKIE_PREFIX}${space.id}`)?.value;
        const hasGuestAccess =
          accessToken !== undefined && accessToken !== ""
            ? verifySpaceAccessToken(accessToken, space.id).valid
            : false;
        if (!hasGuestAccess) {
          return { error: "This team is private", success: false };
        }
      }
    }

    const team = await readTeamRecord(teamId);
    if (!team) {
      return { error: "Team not found", success: false };
    }

    return {
      data: { team: sanitizeTeam(team, userId) },
      success: true,
    };
  } catch (error) {
    log.error({ error, message: "Failed to fetch public team", route: "actions/team-read" });
    return { error: "Failed to fetch team", success: false };
  }
};

const validateTeam = cache(async (teamId: string): Promise<boolean> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return false;
    }

    const space = await prisma.space.findUnique({
      select: { id: true },
      where: { teamId },
    });

    return space !== null;
  } catch (error) {
    log.error({ error, message: "Failed to validate team", route: "actions/team-read" });
    return false;
  }
});

const getTeamName = cache(async (teamId: string): Promise<string | null> => {
  try {
    const summary = await readTeamSummary(teamId);
    const name = summary?.name.trim() ?? "";

    return name.length > 0 ? name : null;
  } catch (error) {
    log.error({ error, message: "Failed to get team name", route: "actions/team-read" });
    return null;
  }
});

export { getPublicTeam, getTeamMembershipRole, getTeamName, validateTeam };
