import { randomUUID } from "node:crypto";

import { prisma } from "@repo/db";
import { hashPassword } from "better-auth/crypto";
import { Redis } from "ioredis";

import { webUrl } from "../../../playwright.config";

import { expect, test as base } from "./auth.fixture";

const PASSWORD = "WorkspaceTestPassword123!";

const test = base.extend<{ createdTeamIds: Array<string> }>({
  createdTeamIds: async ({}, use) => {
    await use([]);
  },
  storageState: async ({ createdTeamIds, playwright }, use) => {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL is required for workspace tests");
    }
    const id = randomUUID();
    const email = `e2e-workspace-${id}@collabtime.localhost`;
    const password = await hashPassword(PASSWORD);
    await prisma.user.create({
      data: {
        accounts: {
          create: { accountId: id, issuer: "local:credential", password, providerId: "credential" },
        },
        email,
        emailVerified: true,
        id,
        name: "Workspace Test User",
      },
    });
    const api = await playwright.request.newContext({
      baseURL: webUrl,
      storageState: { cookies: [], origins: [] },
    });
    const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    try {
      const signIn = await api.post("/api/auth/sign-in/email", {
        data: { email, password: PASSWORD },
      });
      expect(signIn.status()).toBe(200);
      await use(await api.storageState());
    } finally {
      try {
        await api.post("/api/auth/sign-out", { data: {} });
        const spaces = await prisma.space.findMany({
          select: { teamId: true },
          where: { ownerId: id },
        });
        await prisma.user.delete({ where: { id } });
        await redis.del(
          `live-connections:user:${id}`,
          `ratelimit:live-open:user:${id}`,
          ...spaces.map(({ teamId }) => `team:${teamId}`),
          ...createdTeamIds.map((teamId) => `team:${teamId}`),
        );
      } finally {
        redis.disconnect();
        await api.dispose();
      }
    }
  },
});

export { expect } from "./auth.fixture";
export { test };
