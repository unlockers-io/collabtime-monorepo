import { prisma } from "@repo/db";

import { assertLocalDatabase } from "../support/assert-local";
import { E2E_USER } from "../support/users";

// Workspaces the shared user creates would otherwise pile up until it hits the per-user limit.
const cleanup = async () => {
  assertLocalDatabase();

  try {
    const { count } = await prisma.space.deleteMany({
      where: { owner: { email: E2E_USER.email } },
    });

    if (count > 0) {
      console.log(`[E2E Cleanup] Deleted ${count} workspace(s) owned by ${E2E_USER.email}`);
    }
  } finally {
    await prisma.$disconnect();
  }
};

export default cleanup;
