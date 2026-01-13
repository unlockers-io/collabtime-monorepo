/**
 * Internal action utilities for use in API routes.
 * These are NOT marked with "use server" so they can be called from route handlers.
 */

import { redis } from "./redis";
import { UUIDSchema } from "./validation";
import type { Team, TeamRecord } from "@/types";

const getTeamRecord = async (teamId: string): Promise<TeamRecord | null> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return null;
    }

    const data = await redis.get<string>(`team:${teamId}`);

    if (!data) {
      return null;
    }

    const team = typeof data === "string" ? JSON.parse(data) : data;

    // Ensure groups array exists for backward compatibility
    if (!team.groups) {
      team.groups = [];
    }
    if (!team.members) {
      team.members = [];
    }

    return team;
  } catch (error) {
    console.error("Failed to get team:", error);
    return null;
  }
};

const sanitizeTeam = (team: TeamRecord): Team => {
  // Destructure to exclude password hash from public team data
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { adminPasswordHash, ...publicTeam } = team;
  return publicTeam;
};

export { getTeamRecord, sanitizeTeam };
