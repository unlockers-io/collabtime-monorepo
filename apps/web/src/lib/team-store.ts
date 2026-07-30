import { log } from "@/lib/observability";
import type { TeamGroup, TeamMember, TeamRecord } from "@/types";

import { readTeamJson, redis, teamKey, TEAM_ACTIVE_TTL_SECONDS } from "./redis";
import { writeTeamMirror } from "./team-mirror";
import { UUIDSchema } from "./validation";

// Legacy rows may predate `groups`, `members`, or per-member `order`.
type StoredTeamRecord = Omit<TeamRecord, "groups" | "members"> & {
  groups?: Array<TeamGroup>;
  members?: Array<Omit<TeamMember, "order"> & { order?: number }>;
};

const readTeamRecord = async (teamId: string): Promise<TeamRecord | null> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return null;
    }

    const data = await readTeamJson(teamId);

    if (data === null) {
      return null;
    }

    // oxlint-disable-next-line no-unsafe-type-assertion -- team:* keys are written only by writeTeamRecord with a typed TeamRecord; StoredTeamRecord models the legacy gaps backfilled below
    const stored = JSON.parse(data) as StoredTeamRecord;

    return {
      ...stored,
      groups: stored.groups ?? [],
      members: (stored.members ?? []).map((m, i) => Object.assign(m, { order: m.order ?? i })),
    };
  } catch (error) {
    log.error({ error, message: "Failed to get team", route: "lib/team-store" });
    return null;
  }
};

/**
 * Dual-write phase of moving team contents into Postgres: Redis stays the store
 * every read goes through, and the Postgres rows are a shadow copy that the
 * backfill and verify scripts compare against.
 *
 * A failed mirror must not fail the request. Until the read path cuts over, the
 * user's write is already durable in Redis, and re-running the backfill repairs
 * whatever the mirror missed. It logs at error level so the gap is visible.
 */
const writeTeamRecord = async (
  teamId: string,
  team: TeamRecord,
  ttlSeconds: number = TEAM_ACTIVE_TTL_SECONDS,
): Promise<void> => {
  await redis.set(teamKey(teamId), JSON.stringify(team), "EX", ttlSeconds);

  try {
    await writeTeamMirror(teamId, team);
  } catch (error) {
    log.error({ error, message: "Failed to mirror team to Postgres", route: "lib/team-store" });
  }
};

export { readTeamRecord, writeTeamRecord };
