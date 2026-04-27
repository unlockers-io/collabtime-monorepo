// oxlint-disable no-console -- server action diagnostic logging; TODO migrate to structured logger
import type { Team, TeamRecord } from "@/types";

import { redis, TEAM_ACTIVE_TTL_SECONDS } from "../redis";
import { UUIDSchema } from "../validation";

const sanitizeMemberUserId = (
  userId: string | undefined,
  currentUserId: string | undefined,
): { userId: string } | Record<string, never> => {
  if (userId === currentUserId) {
    return userId === undefined ? {} : { userId };
  }
  if (userId) {
    return { userId: "claimed" };
  }
  return {};
};

const sanitizeTeam = (team: TeamRecord, currentUserId?: string): Team => {
  const { adminPasswordHash: _, ...publicTeam } = team;
  return {
    ...publicTeam,
    members: publicTeam.members.map(({ userId, ...member }) =>
      Object.assign(member, sanitizeMemberUserId(userId, currentUserId)),
    ),
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

const persistTeam = async (teamId: string, team: TeamRecord): Promise<void> => {
  await redis.set(`team:${teamId}`, JSON.stringify(team), { ex: TEAM_ACTIVE_TTL_SECONDS });
};

export { getTeamRecord, persistTeam, sanitizeTeam };
