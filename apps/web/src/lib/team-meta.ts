import { cacheLife, cacheTag } from "next/cache";

import { log } from "@/lib/observability";
import { readTeamSummary, teamNameTag } from "@/lib/team-store";
import { UUIDSchema } from "@/lib/validation";

const normalizeTeamName = (name: string | undefined): string | null => {
  const trimmed = name?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
};

const readCachedTeamName = async (teamId: string): Promise<string | null> => {
  "use cache";
  cacheLife("minutes");
  cacheTag(teamNameTag(teamId));

  const summary = await readTeamSummary(teamId);

  return normalizeTeamName(summary?.name);
};

/**
 * `teamId` is the whole cache key, so `readCachedTeamName` must never read anything
 * session-, cookie- or membership-dependent: that would leak across viewers.
 */
const getTeamName = async (teamId: string): Promise<string | null> => {
  if (!UUIDSchema.safeParse(teamId).success) {
    return null;
  }

  try {
    return await readCachedTeamName(teamId);
  } catch (error) {
    log.error({ error, message: "Failed to get team name", route: "lib/team-meta" });

    return null;
  }
};

export { getTeamName, normalizeTeamName };
