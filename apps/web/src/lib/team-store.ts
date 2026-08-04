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

// A blob that fails validation is still read rather than dropped, so nothing the
// schema requires can be assumed present by the time it reaches toTeamRecord.
type MaybeStoredTeam = Partial<StoredTeam>;

const asText = (value: unknown, fallback: string): string =>
  typeof value === "string" && value !== "" ? value : fallback;

const toTeamRecord = (teamId: string, stored: MaybeStoredTeam): TeamRecord => ({
  ...stored,
  createdAt: asText(stored.createdAt, ""),
  groups: Array.isArray(stored.groups) ? stored.groups : [],
  id: asText(stored.id, teamId),
  members: (Array.isArray(stored.members) ? stored.members : []).map((m, i) =>
    Object.assign(m, { order: m.order ?? i }),
  ),
  name: asText(stored.name, ""),
});

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

    const raw: unknown = JSON.parse(data);
    const parsed = StoredTeamSchema.safeParse(raw);

    if (parsed.success) {
      return toTeamRecord(teamId, parsed.data);
    }

    log.error({
      error: parsed.error,
      message: "Stored team failed validation, reading it untrusted",
      route: "lib/team-store",
      teamId,
    });

    // Redis holds the only copy of a team's contents, so a row written before a
    // field existed still has to resolve: dropping it here would 404 the team
    // page, fail every mutation on it, and hide it from the teams list. Only a
    // blob with no fields to read at all is given up on.
    if (typeof raw !== "object" || raw === null) {
      return null;
    }

    return toTeamRecord(teamId, raw);
  } catch (error) {
    log.error({ error, message: "Failed to get team", route: "lib/team-store", teamId });
    return null;
  }
};

type TeamSummary = {
  memberCount: number;
  name: string;
};

const readTeamSummary = async (teamId: string): Promise<TeamSummary | null> => {
  const team = await readTeamRecord(teamId);

  if (team === null) {
    return null;
  }

  return { memberCount: team.members.length, name: team.name };
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
