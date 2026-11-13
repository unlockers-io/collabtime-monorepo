import { execFile } from "node:child_process";
import { availableParallelism } from "node:os";

import { createPrismaClient } from "@repo/db";

const COMPOSE_DATABASE_URL = "postgresql://collabtime:collabtime123@localhost:5433/collabtime";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

const pushSchema = (databaseUrl: string): Promise<void> =>
  new Promise((resolve, reject) => {
    execFile(
      "pnpm",
      ["--filter", "@repo/db", "exec", "prisma", "db", "push"],
      { env: { ...process.env, DATABASE_URL: databaseUrl } },
      (error) => {
        if (error) {
          reject(new Error("Could not push the schema to the test database", { cause: error }));
        } else {
          resolve();
        }
      },
    );
  });

/**
 * Gives every vitest worker its own empty database on the Postgres the dev stack and CI
 * already run, so tests can use fixed ids and truncate freely without touching real rows.
 */
const setup = async () => {
  const server = new URL(process.env.DATABASE_URL ?? COMPOSE_DATABASE_URL);

  if (!LOCAL_HOSTS.has(server.hostname)) {
    throw new Error(`Refusing to create test databases on ${server.hostname}: not localhost.`);
  }

  process.env.DATABASE_URL = server.toString();
  process.env.TEST_DATABASE_SERVER = server.toString();

  const prisma = createPrismaClient(server.toString());
  const prefix = `${server.pathname.slice(1)}_test_`;
  const template = `${prefix}template`;

  const workers = Array.from(
    { length: availableParallelism() },
    (_, index) => prefix + (index + 1),
  );

  const drop = () =>
    Promise.all(
      [...workers, template].map((database) =>
        prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`),
      ),
    );

  try {
    await drop();
  } catch (error) {
    throw new Error(
      `The unit tests need Postgres at ${server.host}. Start it with \`docker compose up -d postgres\`.`,
      { cause: error },
    );
  }

  await prisma.$executeRawUnsafe(`CREATE DATABASE "${template}"`);
  const templateUrl = new URL(server);
  templateUrl.pathname = `/${template}`;
  await pushSchema(templateUrl.toString());

  await Promise.all(
    workers.map((database) =>
      prisma.$executeRawUnsafe(`CREATE DATABASE "${database}" TEMPLATE "${template}"`),
    ),
  );

  return async () => {
    await drop();
    await prisma.$disconnect();
  };
};

export default setup;
