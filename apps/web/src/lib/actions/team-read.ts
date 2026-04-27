"use server";

// oxlint-disable no-console -- server action diagnostic logging; TODO migrate to structured logger
import { prisma } from "@repo/db";
import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "@/lib/auth-server";
import { getTeamRole } from "@/lib/team-auth";
import { isTeamRole } from "@/types";
import type { Team, TeamRole } from "@/types";

import { redis } from "../redis";
import { UUIDSchema } from "../validation";

import { getTeamRecord, sanitizeTeam } from "./helpers";
import type { ActionResult } from "./types";

/**
 * Get a team for public (read-only) access.
 * Private teams require the caller to be a member.
 */
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
        return { error: "This team is private", success: false };
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
    console.error("Failed to fetch public team:", error);
    return { error: "Failed to fetch team", success: false };
  }
};

// Wrapped in `cache()` so generateMetadata + the page render share one lookup
// per request. Both functions are called from both entry points.
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
    console.error("Failed to validate team:", error);
    return false;
  }
});

const getTeamName = cache(async (teamId: string): Promise<string | null> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return null;
    }

    const data = await redis.get<string>(`team:${teamId}`);
    if (!data) {
      return null;
    }

    const team = (typeof data === "string" ? JSON.parse(data) : data) as { name?: string };
    const name = typeof team?.name === "string" ? team.name.trim() : "";
    return name.length > 0 ? name : null;
  } catch (error) {
    console.error("Failed to get team name:", error);
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
