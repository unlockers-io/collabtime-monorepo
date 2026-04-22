import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { Pool } from "pg";

import { PrismaClient } from "./generated/client";

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

  // Better Auth stores credentials in the Account table with providerId "credential"
  const hashedPassword = await hashPassword("password123");

  await prisma.account.upsert({
    create: {
      accountId: user.id,
      password: hashedPassword,
      providerId: "credential",
      userId: user.id,
    },
    update: { password: hashedPassword },
    where: {
      providerId_accountId: {
        accountId: user.id,
        providerId: "credential",
      },
    },
  });

  const space = await prisma.space.upsert({
    create: {
      ownerId: user.id,
      teamId: "test-team",
    },
    update: {},
    where: { teamId: "test-team" },
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

  console.log("Seed complete");
  console.log(`  User: test@collabtime.dev / password123`);
  console.log(`  Team: test-team`);
} catch (error) {
  console.error("Seed failed:", error);
  throw error;
} finally {
  await prisma.$disconnect();
  await pool.end();
}
