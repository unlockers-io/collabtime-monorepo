import { z } from "zod";

import { log } from "@/lib/observability";
import type { TeamRecord } from "@/types";

import { readTeamJson, redis, teamKey, TEAM_ACTIVE_TTL_SECONDS } from "./redis";
import { writeTeamMirror } from "./team-mirror";
import { UUIDSchema } from "./validation";

const StoredGroupSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  order: z.number(),
});

// `order` is optional because legacy rows predate it; it is backfilled on read.
const StoredMemberSchema = z.looseObject({
  groupId: z.string().optional(),
  id: z.string(),
  name: z.string(),
  order: z.number().optional(),
  timezone: z.string(),
  title: z.string(),
  userId: z.string().optional(),
  workingHoursEnd: z.number(),
  workingHoursStart: z.number(),
});

/**
 * Loose rather than strict so a read can feed straight back into
 * writeTeamRecord: an unrecognised key on the blob is someone else's data, and
 * stripping it here would erase it on the next mutation. `groups` and `members`
 * are optional because rows written before those fields existed still resolve.
 */
const StoredTeamSchema = z.looseObject({
  adminPasswordHash: z.string().optional(),
  createdAt: z.string(),
  groups: z.array(StoredGroupSchema).optional(),
  id: z.string(),
  members: z.array(StoredMemberSchema).optional(),
  name: z.string(),
});

type StoredTeam = z.infer<typeof StoredTeamSchema>;

const readStoredTeam = async (teamId: string): Promise<StoredTeam | null> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return null;
    }

    const data = await readTeamJson(teamId);

    if (data === null) {
      return null;
    }

    const parsed = StoredTeamSchema.safeParse(JSON.parse(data));

    if (!parsed.success) {
      log.error({
        error: parsed.error,
        message: "Stored team failed validation",
        route: "lib/team-store",
        teamId,
      });
      return null;
    }

    return parsed.data;
  } catch (error) {
    log.error({ error, message: "Failed to get team", route: "lib/team-store" });
    return null;
  }
};

const readTeamRecord = async (teamId: string): Promise<TeamRecord | null> => {
  const stored = await readStoredTeam(teamId);

  if (stored === null) {
    return null;
  }

  return {
    ...stored,
    groups: stored.groups ?? [],
    members: (stored.members ?? []).map((m, i) => Object.assign(m, { order: m.order ?? i })),
  };
};

type TeamSummary = {
  memberCount: number;
  name: string;
};

const readTeamSummary = async (teamId: string): Promise<TeamSummary | null> => {
  const stored = await readStoredTeam(teamId);

  if (stored === null) {
    return null;
  }

  return { memberCount: stored.members?.length ?? 0, name: stored.name };
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

export { readTeamRecord, readTeamSummary, writeTeamRecord };
export type { TeamSummary };
