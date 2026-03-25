import type { Team, TeamRecord } from "@/types";

import { redis } from "../redis";
import { UUIDSchema } from "../validation";

const sanitizeTeam = (team: TeamRecord, currentUserId?: string): Team => {
  const { adminPasswordHash: _, ...publicTeam } = team;
  return {
    ...publicTeam,
    members: publicTeam.members.map(({ userId, ...member }) => ({
      ...member,
      ...(userId === currentUserId ? { userId } : userId ? { userId: "claimed" } : {}),
    })),
  };
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

    // Backfill order for members that lack it
    team.members = team.members.map((m, i) => ({ ...m, order: m.order ?? i }));

    return team;
  } catch (error) {
    console.error("Failed to get team:", error);
    return null;
  }
};

export { getTeamRecord, sanitizeTeam };
