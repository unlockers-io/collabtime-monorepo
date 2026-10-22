import { type Prisma, prisma } from "@repo/db";

import type { TeamRecord } from "@/types";

import { publishTeamEvent } from "./team-events";
import { readTeams, writeTeam } from "./team-postgres-repository";

type TeamStorage<TTransaction = undefined> = {
  publish: (teamId: string) => Promise<void>;
  read: (teamId: string, transaction?: TTransaction) => Promise<TeamRecord | null>;
  readBatch: (teamIds: Array<string>) => Promise<Array<TeamRecord>>;
  transaction: <T>(teamId: string, run: (transaction: TTransaction) => Promise<T>) => Promise<T>;
  write: (teamId: string, team: TeamRecord, transaction: TTransaction) => Promise<void>;
};

const withTeamTransaction = <T>(
  teamId: string,
  run: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> =>
  prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`team:${teamId}`}, 0))`;

    return run(transaction);
  });

const postgresTeamStorage: TeamStorage<Prisma.TransactionClient> = {
  publish: (teamId) => publishTeamEvent(teamId, "contents"),
  read: async (teamId, transaction = prisma) => {
    const teams = await readTeams([teamId], transaction);

    return teams[0] ?? null;
  },
  readBatch: (teamIds) => readTeams(teamIds, prisma),
  transaction: withTeamTransaction,
  write: writeTeam,
};

export { postgresTeamStorage, withTeamTransaction };

export type { TeamStorage };
