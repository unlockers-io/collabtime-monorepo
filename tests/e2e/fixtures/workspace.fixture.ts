import { randomUUID } from "node:crypto";

import { prisma } from "@repo/db";
import { Redis } from "ioredis";

import { createVerifiedUser } from "../support/users";
import { webUrl } from "../urls";

import { expect, test as base } from "./auth.fixture";

const PASSWORD = "WorkspaceTestPassword123!";

const test = base.extend({
  storageState: async ({ playwright }, use) => {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error("REDIS_URL is required for workspace tests");
    }

    const id = randomUUID();
    const email = `e2e-workspace-${id}@collabtime.localhost`;
    await createVerifiedUser({ email, id, name: "Workspace Test User", password: PASSWORD });

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

        await prisma.user.delete({ where: { id } });
        await redis.del(`live-connections:user:${id}`, `ratelimit:live-open:user:${id}`);
      } finally {
        redis.disconnect();
        await api.dispose();
      }
    }
  },
});

export { expect } from "./auth.fixture";

export { test };
