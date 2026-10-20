import type { TeamRecord } from "@/types";

import type { TeamStorage } from "./team-storage";

const createMemoryTeamStorage = (): TeamStorage => {
  const teams = new Map<string, TeamRecord>();
  const locks = new Map<string, Promise<void>>();
  return {
    publish: () => Promise.resolve(),
    read: (teamId) => Promise.resolve(structuredClone(teams.get(teamId) ?? null)),
    readBatch: (teamIds) =>
      Promise.resolve(
        teamIds.flatMap((id) => {
          const team = teams.get(id);
          return team ? [structuredClone(team)] : [];
        }),
      ),
    transaction: async (teamId, run) => {
      const previous = locks.get(teamId);
      const gate = Promise.withResolvers<undefined>();
      locks.set(teamId, gate.promise);
      await previous;
      const before = teams.get(teamId);
      try {
        return await run(undefined);
      } catch (error) {
        if (before) {
          teams.set(teamId, before);
        } else {
          teams.delete(teamId);
        }
        throw error;
      } finally {
        gate.resolve(undefined);
        if (locks.get(teamId) === gate.promise) {
          locks.delete(teamId);
        }
      }
    },
    write: (teamId, team) => {
      teams.set(teamId, structuredClone(team));
      return Promise.resolve();
    },
  };
};
export { createMemoryTeamStorage };
