import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "./generated/client";

declare global {
  var prisma: PrismaClient | undefined;
}

const assertDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url.trim() === "") {
    throw new Error(
      "DATABASE_URL is not set. Set it in the environment; packages/db/.env.example has the local value.",
    );
  }
};

class PrismaPgRequiringUrl extends PrismaPg {
  override async connect() {
    assertDatabaseUrl();
    return super.connect();
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPgRequiringUrl(pool);

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

export * from "./generated/client";
