import { prisma } from "@repo/db";
import { Redis } from "ioredis";
import { z } from "zod";

import { writeTeamMirror } from "../src/lib/team-postgres-repository";
import type { TeamMember, TeamRecord } from "../src/types";

const SCAN_COUNT = 200;

const legacyMemberSchema = z.looseObject({
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

const legacyGroupSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  order: z.number(),
});

const legacyTeamSchema = z.looseObject({
  adminPasswordHash: z.string().optional(),
  createdAt: z.string().optional(),
  groups: z.array(legacyGroupSchema).optional(),
  id: z.string(),
  members: z.array(legacyMemberSchema).optional(),
  name: z.string(),
});

const parseTeam = (raw: string): TeamRecord | null => {
  const result = legacyTeamSchema.safeParse(JSON.parse(raw));
  if (!result.success) {
    return null;
  }
  const candidate = result.data;
  const groupIds = new Set((candidate.groups ?? []).map((group) => group.id));

  return {
    ...candidate,
    createdAt: candidate.createdAt ?? new Date(0).toISOString(),
    groups: candidate.groups ?? [],
    id: candidate.id,
    members: (candidate.members ?? []).map((member, index) =>
      Object.assign(member, {
        // The app reads a dangling groupId as ungrouped, and the mirror's foreign key rejects it.
        groupId:
          member.groupId !== undefined && groupIds.has(member.groupId) ? member.groupId : undefined,
        order: member.order ?? index,
      }),
    ),
    name: candidate.name,
  };
};

const readTeamMirror = async (teamId: string): Promise<TeamRecord | null> => {
  const space = await prisma.space.findUnique({
    include: {
      groups: { orderBy: { order: "asc" } },
      members: { orderBy: { order: "asc" } },
    },
    where: { teamId },
  });

  if (!space) {
    return null;
  }

  const team: TeamRecord = {
    createdAt: space.createdAt.toISOString(),
    groups: space.groups.map((group) => ({ id: group.id, name: group.name, order: group.order })),
    id: space.teamId,
    members: space.members.map((row) => {
      const member: TeamMember = {
        id: row.id,
        name: row.name,
        order: row.order,
        timezone: row.timezone,
        title: row.title,
        workingHoursEnd: row.workingHoursEnd,
        workingHoursStart: row.workingHoursStart,
      };
      if (row.groupId !== null) {
        member.groupId = row.groupId;
      }
      if (row.userId !== null) {
        member.userId = row.userId;
      }
      return member;
    }),
    name: space.name,
  };
  if (space.adminPasswordHash !== null) {
    team.adminPasswordHash = space.adminPasswordHash;
  }
  return team;
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

/**
 * `createdAt` is excluded on purpose: the blob carries the string the app wrote,
 * the mirror carries `Space.createdAt`, and for teams created before the space
 * row those two legitimately differ. Everything else must match exactly.
 */
const diffTeamMirror = (expected: TeamRecord, actual: TeamRecord | null): Array<string> => {
  if (actual === null) {
    return ["missing from Postgres"];
  }

  const problems: Array<string> = [];

  if (expected.name !== actual.name) {
    problems.push(`name "${expected.name}" != "${actual.name}"`);
  }
  if ((expected.adminPasswordHash ?? null) !== (actual.adminPasswordHash ?? null)) {
    problems.push("adminPasswordHash differs");
  }
  if (canonicalGroups(expected.groups) !== canonicalGroups(actual.groups)) {
    problems.push(`groups differ (${expected.groups.length} vs ${actual.groups.length})`);
  }
  if (canonicalMembers(expected.members) !== canonicalMembers(actual.members)) {
    problems.push(`members differ (${expected.members.length} vs ${actual.members.length})`);
  }

  return problems;
};

const main = async (): Promise<void> => {
  const url = process.env.REDIS_URL;
  if (url === undefined || url === "") {
    throw new Error("REDIS_URL is not set");
  }

  const verifyOnly = process.argv.includes("--verify-only");
  const redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });

  let cursor = "0";
  let scanned = 0;
  let written = 0;
  const problems: Array<string> = [];

  try {
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "team:*", "COUNT", SCAN_COUNT);
      cursor = nextCursor;

      for (const key of keys) {
        const teamId = key.slice("team:".length);
        scanned += 1;

        const raw = await redis.get(key);
        if (raw === null) {
          continue;
        }

        const team = parseTeam(raw);
        if (team === null) {
          problems.push(`${teamId}: blob is not a team record`);
          continue;
        }

        const space = await prisma.space.findUnique({ select: { id: true }, where: { teamId } });
        if (space === null) {
          problems.push(`${teamId}: no Space row`);
          continue;
        }

        if (!verifyOnly) {
          await writeTeamMirror(teamId, team);
          written += 1;
        }

        for (const problem of diffTeamMirror(team, await readTeamMirror(teamId))) {
          problems.push(`${teamId}: ${problem}`);
        }
      }
    } while (cursor !== "0");
  } finally {
    await redis.quit();
    await prisma.$disconnect();
  }

  console.log(
    `${verifyOnly ? "[verify-only] " : ""}scanned ${scanned} team keys, ${written} mirrored, ${problems.length} problem(s)`,
  );

  for (const problem of problems.slice(0, 50)) {
    console.log(`  ${problem}`);
  }
  if (problems.length > 50) {
    console.log(`  … and ${problems.length - 50} more`);
  }

  if (problems.length > 0) {
    process.exitCode = 1;
  }
};

await main();
