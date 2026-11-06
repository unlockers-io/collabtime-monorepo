import { randomUUID } from "node:crypto";

import { prisma } from "@repo/db";
import { hashPassword } from "better-auth/crypto";

/** The shared signed-in user every authenticated project starts as. */
const E2E_USER = {
  email: "e2e-test@collabtime.localhost",
  id: "e2e-test-user",
  name: "E2E Test User",
  password: "TestPassword123!",
};

const CREDENTIAL = { issuer: "local:credential", providerId: "credential" } as const;

type VerifiedUser = { email: string; id?: string; name: string; password: string };

/** A verified email-and-password user, written straight to the database. */
const createVerifiedUser = async ({
  email,
  id = randomUUID(),
  name,
  password,
}: VerifiedUser): Promise<string> => {
  await prisma.user.create({
    data: {
      accounts: {
        create: { ...CREDENTIAL, accountId: id, password: await hashPassword(password) },
      },
      email,
      emailVerified: true,
      id,
      name,
    },
  });

  return id;
};

/** Creates the shared e2e user, or resets its name, verification and password. */
const ensureE2EUser = async (): Promise<void> => {
  const password = await hashPassword(E2E_USER.password);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      create: { email: E2E_USER.email, emailVerified: true, id: E2E_USER.id, name: E2E_USER.name },
      update: { emailVerified: true, name: E2E_USER.name },
      where: { email: E2E_USER.email },
    });

    await tx.account.upsert({
      create: { ...CREDENTIAL, accountId: user.id, password, userId: user.id },
      update: { password },
      where: { issuer_accountId: { accountId: user.id, issuer: CREDENTIAL.issuer } },
    });
  });
};

export { createVerifiedUser, E2E_USER, ensureE2EUser };
