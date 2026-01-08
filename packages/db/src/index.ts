import "dotenv/config";
import { PrismaClient } from "./generated/client";
import { PrismaPlanetScale } from "@prisma/adapter-planetscale";
import { fetch as undiciFetch } from "undici";

const adapter = new PrismaPlanetScale({
  url: process.env.DATABASE_URL,
  fetch: undiciFetch,
});
const prisma = new PrismaClient({ adapter });

export { prisma };

export type { PrismaClient };
export * from "./generated/client";
