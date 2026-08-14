import { prisma } from "@repo/db";
import { Redis } from "ioredis";

import {
  diffTeamMirror,
  readTeamMirror,
  writeTeamMirror,
} from "../src/lib/team-postgres-repository";
import type { TeamRecord } from "../src/types";

const SCAN_COUNT = 200;

const parseTeam = (raw: string): TeamRecord | null => {
  const parsed: unknown = JSON.parse(raw);

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const candidate = parsed as Partial<TeamRecord>;

  if (typeof candidate.id !== "string" || typeof candidate.name !== "string") {
    return null;
  }

  return {
    ...candidate,
    createdAt: candidate.createdAt ?? new Date(0).toISOString(),
    groups: candidate.groups ?? [],
    id: candidate.id,
    members: (candidate.members ?? []).map((member, index) =>
      Object.assign(member, { order: member.order ?? index }),
    ),
    name: candidate.name,
  };
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
