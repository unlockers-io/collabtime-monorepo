import { prisma } from "@repo/db";
import { Redis } from "ioredis";

import { readTeams, writeTeam } from "../src/lib/team-postgres-repository";
import { decodeTeam } from "../src/lib/team-record-codec";
import { withTeamTransaction } from "../src/lib/team-storage";
import type { TeamMember, TeamRecord } from "../src/types";

const SCAN_COUNT = 200;

const readTeamRecord = async (teamId: string): Promise<TeamRecord | null> => {
  const teams = await readTeams([teamId], prisma, false);
  return teams[0] ?? null;
};

const FIELD_SEPARATOR = "\u0000";

const canonicalGroups = (groups: TeamRecord["groups"]): string =>
  groups
    .toSorted((a, b) => a.id.localeCompare(b.id))
    .map((group) => [group.id, group.order, group.name].join(FIELD_SEPARATOR))
    .join("\n");

const canonicalMembers = (members: Array<TeamMember>): string =>
  members
    .toSorted((a, b) => a.id.localeCompare(b.id))
    .map((member) =>
      [
        member.id,
        member.order,
        member.name,
        member.title,
        member.timezone,
        member.workingHoursStart,
        member.workingHoursEnd,
        member.groupId ?? "",
        member.userId ?? "",
      ].join(FIELD_SEPARATOR),
    )
    .join("\n");

const comparableFields = (team: TeamRecord) => ({
  adminPasswordHash: team.adminPasswordHash ?? "",
  createdAt: team.createdAt,
  groups: canonicalGroups(team.groups),
  members: canonicalMembers(team.members),
  name: team.name,
});
const comparedFields = ["adminPasswordHash", "createdAt", "groups", "members", "name"] as const;
const diffTeam = (expected: TeamRecord, actual: TeamRecord | null): Array<string> => {
  if (actual === null) {
    return ["missing from Postgres"];
  }
  const before = comparableFields(expected);
  const after = comparableFields(actual);
  return comparedFields.flatMap((field) =>
    before[field] === after[field] ? [] : [`${field} differs`],
  );
};

const loadSnapshot = async (redis: Redis, key: string, teamId: string) => {
  const raw = await redis.get(key);
  if (raw === null) {
    return null;
  }
  const ttl = await redis.pttl(key);
  if (ttl <= 0) {
    throw new Error(`${teamId}: missing finite Redis retention`);
  }
  const team = decodeTeam(teamId, raw);
  const deadline = await redis.pexpiretime(key);
  return { expiresAt: new Date(deadline), team };
};

type Snapshot = { expiresAt: Date; team: TeamRecord };
const readSnapshots = async (redis: Redis): Promise<Map<string, Snapshot>> => {
  const snapshots = new Map<string, Snapshot>();
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "team:*", "COUNT", SCAN_COUNT);
    cursor = nextCursor;
    for (const key of keys) {
      const teamId = key.slice("team:".length);
      const snapshot = await loadSnapshot(redis, key, teamId);
      if (snapshot !== null) {
        snapshots.set(teamId, snapshot);
      }
    }
  } while (cursor !== "0");
  return snapshots;
};
const claimedUsers = (team: TeamRecord): Array<string> =>
  team.members.flatMap((member) =>
    member.userId !== undefined && member.userId !== "" ? [member.userId] : [],
  );
const validateClaims = async (teamId: string, team: TeamRecord): Promise<void> => {
  const claimed = claimedUsers(team);
  const memberships = await prisma.membership.findMany({
    select: { userId: true },
    where: { teamId, userId: { in: claimed } },
  });
  const users = new Set(memberships.map((membership) => membership.userId));
  if (claimed.some((userId) => !users.has(userId))) {
    throw new Error(`${teamId}: claimed user has no membership`);
  }
  if (new Set(claimed).size !== claimed.length) {
    throw new Error(`${teamId}: user has multiple claimed slots`);
  }
};
const validateSnapshot = async (teamId: string, team: TeamRecord): Promise<void> => {
  const space = await prisma.space.findUnique({
    select: { teamCreatedAt: true },
    where: { teamId },
  });
  if (space === null) {
    throw new Error(`${teamId}: no Space row`);
  }
  await validateClaims(teamId, team);
  if (space.teamCreatedAt !== null && diffTeam(team, await readTeamRecord(teamId)).length > 0) {
    throw new Error(`${teamId}: initialized PostgreSQL contents differ; refusing overwrite`);
  }
};
const verifySnapshot = async (
  teamId: string,
  { expiresAt, team }: Snapshot,
): Promise<Array<string>> => {
  const problems = diffTeam(team, await readTeamRecord(teamId));
  const stored = await prisma.space.findUniqueOrThrow({
    select: { teamExpiresAt: true },
    where: { teamId },
  });
  if (stored.teamExpiresAt?.getTime() !== expiresAt.getTime()) {
    problems.push("retention deadline differs");
  }
  return problems.map((problem) => `${teamId}: ${problem}`);
};
const importSnapshots = async (
  snapshots: Map<string, Snapshot>,
  apply: boolean,
): Promise<Array<string>> => {
  for (const [teamId, { team }] of snapshots) {
    await validateSnapshot(teamId, team);
  }
  const problems: Array<string> = [];
  for (const [teamId, snapshot] of snapshots) {
    if (apply) {
      await withTeamTransaction(teamId, (transaction) =>
        writeTeam(teamId, snapshot.team, transaction, snapshot.expiresAt),
      );
    }
    problems.push(...(await verifySnapshot(teamId, snapshot)));
  }
  return problems;
};
const configuredRedis = (): Redis => {
  const url = process.env.REDIS_URL;
  if (url === undefined || url === "") {
    throw new Error("REDIS_URL is not set");
  }
  if (!process.argv.includes("--writers-stopped")) {
    throw new Error("Stop every old and new app writer, then pass --writers-stopped");
  }
  return new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
};
const main = async (): Promise<void> => {
  const redis = configuredRedis();
  const apply = process.argv.includes("--apply");
  try {
    const snapshots = await readSnapshots(redis);
    const problems = await importSnapshots(snapshots, apply);
    console.log(
      `scanned ${snapshots.size} team keys, ${apply ? snapshots.size : 0} imported, ${problems.length} problem(s)`,
    );
    if (problems.length > 0) {
      console.log(problems.join("\n"));
      process.exitCode = 1;
    }
  } finally {
    await redis.quit();
    await prisma.$disconnect();
  }
};
await main();
