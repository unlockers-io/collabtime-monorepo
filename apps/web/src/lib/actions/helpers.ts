"use server";

import type { Team, TeamRecord } from "@/types";

import { redis } from "../redis";
import { UUIDSchema } from "../validation";

const sanitizeTeam = (team: TeamRecord): Team => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { adminPasswordHash, ...publicTeam } = team;
  return publicTeam;
};

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

    const team = (typeof data === "string" ? JSON.parse(data) : data) as TeamRecord;

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

export { getTeamRecord, sanitizeTeam };
