"use server";

import { prisma } from "@repo/db";
import { cookies, headers } from "next/headers";
import { cache } from "react";

import { auth } from "@/lib/auth-server";
import { log } from "@/lib/observability";
import { SPACE_ACCESS_COOKIE_PREFIX, verifySpaceAccessToken } from "@/lib/space-access";
import { getTeamRole } from "@/lib/team-auth";
import { isTeamRole } from "@/types";
import type { Team, TeamRole } from "@/types";

import { redis } from "../redis";
import { UUIDSchema } from "../validation";

import { getTeamRecord, sanitizeTeam } from "./helpers";
import type { ActionResult } from "./types";

const getPublicTeam = async (
  teamId: string,
): Promise<ActionResult<{ role: TeamRole; team: Team }>> => {
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

    if (space.isPrivate) {
      const teamRole = await getTeamRole(teamId);
      if (!teamRole) {
        // Guest cookie must match the page gate so guests can load team data.
        const cookieStore = await cookies();
        const accessToken = cookieStore.get(`${SPACE_ACCESS_COOKIE_PREFIX}${space.id}`)?.value;
        const hasGuestAccess = accessToken
          ? verifySpaceAccessToken(accessToken, space.id).valid
          : false;
        if (!hasGuestAccess) {
          return { error: "This team is private", success: false };
        }
      }
    }

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { error: "Team not found", success: false };
    }

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
    const userId = session?.user?.id;

    let role: TeamRole = "MEMBER";
    if (userId) {
      const membership = await prisma.membership.findUnique({
        where: { userId_teamId: { teamId, userId } },
      });
      if (membership && isTeamRole(membership.role)) {
        role = membership.role;
      }
    }

    return {
      data: { role, team: sanitizeTeam(team, userId) },
      success: true,
    };
  } catch (error) {
    log.error({ error, message: "Failed to fetch public team", route: "actions/team-read" });
    return { error: "Failed to fetch team", success: false };
  }
};

// `cache()` dedupes generateMetadata + page render lookups per request.
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
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return null;
    }

    const data = await redis.get(`team:${teamId}`);
    if (!data) {
      return null;
    }

    const team = JSON.parse(data) as { name?: string };
    const name = typeof team?.name === "string" ? team.name.trim() : "";
    return name.length > 0 ? name : null;
  } catch (error) {
    log.error({ error, message: "Failed to get team name", route: "actions/team-read" });
    return null;
  }
});

const getTeamMembershipRole = async (teamId: string, userId: string): Promise<TeamRole | null> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return null;
    }

    const membership = await prisma.membership.findUnique({
      where: { userId_teamId: { teamId, userId } },
    });

    if (membership && isTeamRole(membership.role)) {
      return membership.role;
    }

    return null;
  } catch {
    return null;
  }
};

export { getPublicTeam, getTeamMembershipRole, getTeamName, validateTeam };
