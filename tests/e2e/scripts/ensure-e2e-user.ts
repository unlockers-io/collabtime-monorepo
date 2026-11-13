import { prisma } from "../helpers/database";
import { assertLocalDatabase } from "../support/assert-local";
import { E2E_USER, ensureE2EUser } from "../support/users";

assertLocalDatabase();

await ensureE2EUser();

console.log(`✓ e2e user ${E2E_USER.email} ready; password: ${E2E_USER.password}`);

await prisma.$disconnect();
