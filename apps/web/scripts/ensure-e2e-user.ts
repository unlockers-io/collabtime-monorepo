import { prisma } from "@repo/db";

import { getAuth } from "@/lib/auth-server";

const EMAIL = "e2e-test@collabtime.localhost";
const NAME = "E2E Test User";
const PASSWORD = "TestPassword123!";
const SLUG = "e2e-test-user";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

const assertLocal = (name: string, value: string): void => {
  const host = URL.canParse(value) ? new URL(value).hostname : "";

  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run ensure-e2e-user.ts: ${name} points at ${host || "an unparsable URL"}, not localhost.`,
    );
  }
};

const main = async () => {
  assertLocal("DATABASE_URL", process.env.DATABASE_URL ?? "");
  assertLocal("REDIS_URL", process.env.REDIS_URL ?? "");

  const ctx = await getAuth().$context;
  const hashed = await ctx.password.hash(PASSWORD);

  const user = await prisma.user.upsert({
    create: {
      email: EMAIL,
      emailVerified: true,
      id: SLUG,
      name: NAME,
    },
    update: {
      emailVerified: true,
      name: NAME,
    },
    where: { email: EMAIL },
  });

  await prisma.account.upsert({
    create: {
      accountId: user.id,
      issuer: "local:credential",
      password: hashed,
      providerId: "credential",
      userId: user.id,
    },
    update: { password: hashed },
    where: { issuer_accountId: { accountId: user.id, issuer: "local:credential" } },
  });

  // eslint-disable-next-line no-console -- CI step output: surface the seed result.
  console.log(`✓ e2e user ${EMAIL} ready; password: ${PASSWORD}`);
  await prisma.$disconnect();
};

await main();
