/// <reference types="node" />

import "dotenv/config";

import { defineConfig } from "prisma/config";

// pg reads PGAPPNAME itself; Prisma's schema engine needs the URL parameter.
const databaseUrl = () => {
  const value = process.env.DATABASE_URL ?? "";
  const applicationName = process.env.PGAPPNAME;
  if (value === "" || !applicationName) {
    return value;
  }
  const url = new URL(value);
  url.searchParams.set("application_name", applicationName);
  return url.toString();
};

export default defineConfig({
  datasource: {
    url: databaseUrl(),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx src/seed.ts",
  },
  schema: "prisma/schema.prisma",
});
