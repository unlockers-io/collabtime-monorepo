// @vitest-environment node
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";

import { Redis } from "ioredis";
import { afterAll, describe, expect, it } from "vitest";

import { getPrisma } from "@/lib/db";

import { createTestGroup, createTestMember, createTestTeamRecord } from "./actions/test-helpers";
import { readTeams, writeTeam } from "./team-postgres-repository";
import { withTeamTransaction } from "./team-storage";

const execute = (file: string, args: Array<string>): Promise<{ stdout: string }> =>
  new Promise((resolve, reject) => {
    execFile(file, args, (error, stdout) => {
      if (error) {
        reject(new Error(error.message, { cause: error }));
      } else {
        resolve({ stdout });
      }
    });
  });

const enabled = process.env.MEMBERSHIP_POSTGRES_TESTS === "1";

const cutover = (...args: Array<string>) =>
  execute(process.execPath, [
    "--import",
    "tsx",
    "scripts/cutover-team-store.ts",
    "--writers-stopped",
    ...args,
  ]);

describe.skipIf(!enabled)("PostgreSQL contents and explicit Redis cutover", () => {
  const users: Array<string> = [];
  const keys: Array<string> = [];

  const redis = new Redis(process.env.REDIS_URL ?? "", {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  const setup = async () => {
    const owner = await getPrisma().user.create({
      data: { email: `cutover-${randomUUID()}@example.com` },
    });

    users.push(owner.id);
    const teamId = randomUUID();
    await getPrisma().space.create({ data: { ownerId: owner.id, teamId } });
    const group = createTestGroup({ id: randomUUID() });

    const team = createTestTeamRecord({
      adminPasswordHash: "private-hash",
      groups: [group],
      id: teamId,
      members: [createTestMember({ groupId: group.id, id: randomUUID(), userId: owner.id })],
    });

    await getPrisma().membership.create({ data: { role: "ADMIN", teamId, userId: owner.id } });

    return { owner, team, teamId };
  };

  const seedRedis = async (team: ReturnType<typeof createTestTeamRecord>) => {
    const key = `team:${team.id}`;
    keys.push(key);
    await redis.set(key, JSON.stringify(team), "EX", 600);

    return redis.pexpiretime(key);
  };

  afterAll(async () => {
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    redis.disconnect();
    await getPrisma().user.deleteMany({ where: { id: { in: users } } });
    await getPrisma().$disconnect();
  });
  it("imports actual data and exact expiry, verifies it, and refuses stale overwrite", async () => {
    const { team, teamId } = await setup();
    const deadline = await seedRedis(team);

    try {
      await expect(cutover()).rejects.toThrow("Command failed");
      const imported = await cutover("--apply");
      expect(imported.stdout).toContain("1 imported, 0 problem(s)");
      expect(await readTeams([teamId], getPrisma(), false)).toEqual([team]);
      const space = await getPrisma().space.findUniqueOrThrow({ where: { teamId } });
      expect(space.teamExpiresAt?.getTime()).toBe(deadline);
      const verified = await cutover();
      expect(verified.stdout).toContain("0 problem(s)");
      await getPrisma().space.update({ data: { name: "New canonical write" }, where: { teamId } });
      await expect(cutover("--apply")).rejects.toThrow("Command failed");
      expect(await getPrisma().space.findUnique({ where: { teamId } })).toMatchObject({
        name: "New canonical write",
      });
    } finally {
      await redis.del(`team:${teamId}`);
    }
  }, 20_000);
  it("validates all claims before importing any team", async () => {
    const valid = await setup();
    const invalid = await setup();
    invalid.team.members[0]!.userId = "no-membership";
    await seedRedis(valid.team);
    await seedRedis(invalid.team);

    try {
      await expect(cutover("--apply")).rejects.toThrow("Command failed");

      const spaces = await getPrisma().space.findMany({
        where: { teamId: { in: [valid.teamId, invalid.teamId] } },
      });

      expect(spaces.every((space) => space.teamCreatedAt === null)).toBe(true);
    } finally {
      await redis.del(`team:${valid.teamId}`, `team:${invalid.teamId}`);
    }
  }, 20_000);
  it("updates changed rows without rewriting unchanged members", async () => {
    const { team, teamId } = await setup();
    await withTeamTransaction(teamId, (transaction) => writeTeam(teamId, team, transaction));

    const before = await getPrisma().$queryRaw<
      Array<{ version: string }>
    >`SELECT xmin::text AS version FROM "TeamMember" WHERE "teamId" = ${teamId}`;

    await withTeamTransaction(teamId, (transaction) =>
      writeTeam(teamId, { ...team, name: "Renamed" }, transaction),
    );

    const after = await getPrisma().$queryRaw<
      Array<{ version: string }>
    >`SELECT xmin::text AS version FROM "TeamMember" WHERE "teamId" = ${teamId}`;

    expect(after).toEqual(before);
    const members = team.members.map((member) => ({ ...member, groupId: undefined }));
    await withTeamTransaction(teamId, (transaction) =>
      writeTeam(teamId, { ...team, groups: [], members }, transaction),
    );
    expect(await getPrisma().teamMember.findMany({ where: { teamId } })).toMatchObject([
      { groupId: null },
    ]);
    expect(await getPrisma().teamGroup.count({ where: { teamId } })).toBe(0);
  });

  it("preserves initial and active retention without reviving expired records", async () => {
    const { team, teamId } = await setup();
    const now = Date.now();
    await withTeamTransaction(teamId, (transaction) => writeTeam(teamId, team, transaction));
    const initial = await getPrisma().space.findUniqueOrThrow({ where: { teamId } });
    expect(initial.teamExpiresAt!.getTime() - now).toBeGreaterThanOrEqual(60 * 86_400_000);
    expect(initial.teamExpiresAt!.getTime() - now).toBeLessThan(60 * 86_400_000 + 10_000);
    await readTeams([teamId], getPrisma());
    const active = await getPrisma().space.findUniqueOrThrow({ where: { teamId } });
    expect(active.teamExpiresAt!.getTime() - now).toBeGreaterThanOrEqual(730 * 86_400_000);
    await getPrisma().space.update({ data: { teamExpiresAt: new Date(0) }, where: { teamId } });
    expect(await readTeams([teamId], getPrisma())).toEqual([]);
    expect(await getPrisma().space.findUnique({ where: { teamId } })).toMatchObject({
      teamExpiresAt: new Date(0),
    });
  });
});
