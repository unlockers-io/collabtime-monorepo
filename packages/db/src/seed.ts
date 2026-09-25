import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { Redis } from "ioredis";
import { Pool } from "pg";

import { PrismaClient } from "./generated/client";

const assertLocal = (name: string, value: string): void => {
  const host = URL.canParse(value) ? new URL(value).hostname : "";
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`Refusing to seed: ${name} must point at localhost.`);
  }
};

assertLocal("DATABASE_URL", process.env.DATABASE_URL ?? "");
assertLocal("REDIS_URL", process.env.REDIS_URL ?? "");
const redis = new Redis(process.env.REDIS_URL ?? "", {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});
const TEAM_ID = "00000000-0000-4000-8000-000000000001";
const MEMBER_ID = "00000000-0000-4000-8000-000000000002";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

try {
  console.log("Seeding database...");

  const user = await prisma.user.upsert({
    create: {
      email: "test@collabtime.dev",
      emailVerified: true,
      name: "Test User",
    },
    update: {},
    where: { email: "test@collabtime.dev" },
  });

  const hashedPassword = await hashPassword("TestPassword123!");

  await prisma.account.upsert({
    create: {
      accountId: user.id,
      issuer: "local:credential",
      password: hashedPassword,
      providerId: "credential",
      userId: user.id,
    },
    update: { password: hashedPassword },
    where: {
      issuer_accountId: {
        accountId: user.id,
        issuer: "local:credential",
      },
    },
  });

  const space = await prisma.space.upsert({
    create: {
      ownerId: user.id,
      teamId: TEAM_ID,
    },
    update: {},
    where: { teamId: TEAM_ID },
  });

  await prisma.membership.upsert({
    create: {
      role: "ADMIN",
      teamId: space.teamId,
      userId: user.id,
    },
    update: {},
    where: {
      userId_teamId: {
        teamId: space.teamId,
        userId: user.id,
      },
    },
  });

  const member = {
    id: MEMBER_ID,
    name: "Test User",
    order: 0,
    timezone: "America/Sao_Paulo",
    title: "Team lead",
    userId: user.id,
    workingHoursEnd: 17,
    workingHoursStart: 9,
  };
  await prisma.$transaction([
    prisma.space.update({ data: { name: "Sample workspace" }, where: { teamId: TEAM_ID } }),
    prisma.teamMember.upsert({
      create: { ...member, teamId: TEAM_ID },
      update: member,
      where: { id: MEMBER_ID },
    }),
  ]);
  const seeded = await prisma.space.findUniqueOrThrow({
    include: { groups: { orderBy: { order: "asc" } }, members: { orderBy: { order: "asc" } } },
    where: { teamId: TEAM_ID },
  });
  const team = {
    createdAt: seeded.createdAt.toISOString(),
    groups: seeded.groups.map(({ id, name, order }) => ({ id, name, order })),
    id: TEAM_ID,
    members: seeded.members.map(({ groupId, teamId: _teamId, userId, ...rest }) => {
      const seededMember: typeof rest & { groupId?: string; userId?: string } = { ...rest };
      if (groupId !== null) {
        seededMember.groupId = groupId;
      }
      if (userId !== null) {
        seededMember.userId = userId;
      }
      return seededMember;
    }),
    name: seeded.name,
  };
  await redis.set(`team:${TEAM_ID}`, JSON.stringify(team), "EX", 60 * 60 * 24 * 60);

  console.log("Seed complete");
  console.log(`  User: test@collabtime.dev / TestPassword123!`);
  console.log(`  Team: ${TEAM_ID}`);
} catch (error) {
  console.error("Seed failed:", error);
  throw error;
} finally {
  redis.disconnect();
  await prisma.$disconnect();
  await pool.end();
}
