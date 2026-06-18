import "dotenv/config";

import { hashPassword } from "better-auth/crypto";

import { db } from "./client";
import { account, membership, space, user } from "./schema";

try {
  console.log("Seeding database...");

  const [seededUser] = await db
    .insert(user)
    .values({
      email: "test@collabtime.dev",
      emailVerified: true,
      id: "seed-user-1",
      name: "Test User",
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      set: { emailVerified: true, name: "Test User", updatedAt: new Date().toISOString() },
      target: user.email,
    })
    .returning();

  const hashedPassword = await hashPassword("password123");

  await db
    .insert(account)
    .values({
      accountId: seededUser.id,
      id: `${seededUser.id}-credential`,
      password: hashedPassword,
      providerId: "credential",
      updatedAt: new Date().toISOString(),
      userId: seededUser.id,
    })
    .onConflictDoUpdate({
      set: { password: hashedPassword, updatedAt: new Date().toISOString() },
      target: [account.providerId, account.accountId],
    });

  const [seededSpace] = await db
    .insert(space)
    .values({
      id: "seed-space-1",
      ownerId: seededUser.id,
      teamId: "test-team",
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      set: { ownerId: seededUser.id, updatedAt: new Date().toISOString() },
      target: space.teamId,
    })
    .returning();

  await db
    .insert(membership)
    .values({
      id: "seed-membership-1",
      role: "ADMIN",
      teamId: seededSpace.teamId,
      updatedAt: new Date().toISOString(),
      userId: seededUser.id,
    })
    .onConflictDoUpdate({
      set: { role: "ADMIN", updatedAt: new Date().toISOString() },
      target: [membership.userId, membership.teamId],
    });

  console.log("Seed complete");
  console.log("  User: test@collabtime.dev / password123");
  console.log("  Team: test-team");
} catch (error) {
  console.error("Seed failed:", error);
  throw error;
}
