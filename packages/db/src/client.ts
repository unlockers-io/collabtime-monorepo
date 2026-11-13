import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "./generated/client";

const createPrismaClient = (databaseUrl: string) => {
  // node-postgres reads a blank connection string as absent and connects to libpq's defaults.
  if (databaseUrl.trim() === "") {
    throw new Error("createPrismaClient needs a database URL and got a blank one.");
  }

  const pool = new Pool({ connectionString: databaseUrl });

  return new PrismaClient({ adapter: new PrismaPg(pool, { disposeExternalPool: true }) });
};

export { createPrismaClient };

export * from "./generated/client";
