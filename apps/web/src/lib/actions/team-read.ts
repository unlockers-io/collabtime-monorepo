"use server";

import { prisma } from "@repo/db";

import { getTeamRole } from "@/lib/team-auth";
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
      return { success: false, error: "Invalid team ID" };
    }

    const space = await prisma.space.findUnique({
      where: { teamId },
    });

    if (space?.isPrivate) {
      const teamRole = await getTeamRole(teamId);
      if (!teamRole) {
        return { success: false, error: "This team is private" };
      }
    }

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    return {
      success: true,
      data: { team: sanitizeTeam(team), role: "member" },
    };
  } catch (error) {
    console.error("Failed to fetch public team:", error);
    return { success: false, error: "Failed to fetch team" };
  }
};

const validateTeam = async (teamId: string): Promise<boolean> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return false;
    }

    const exists = await redis.exists(`team:${teamId}`);
    return exists === 1;
  } catch (error) {
    console.error("Failed to validate team:", error);
    return false;
  }
};

const getTeamName = async (teamId: string): Promise<string | null> => {
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
};

export { getPublicTeam, getTeamName, validateTeam };
