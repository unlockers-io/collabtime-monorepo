import type { TeamStorage } from "./team-storage";

const createMemoryTeamStorage = (): TeamStorage => {
  const contents = new Map<string, string>();
  const read = (teamId: string): string | null => {
    const value = contents.get(teamId);
    return value === "" ? null : (value ?? null);
  };

  return {
    compareAndSet: (teamId, expected, next) => {
      if (read(teamId) !== expected) {
        return Promise.resolve(false);
      }

      contents.set(teamId, next);
      return Promise.resolve(true);
    },
    mirror: () => Promise.resolve(),
    publish: () => Promise.resolve(),
    readContents: (teamId) => Promise.resolve(read(teamId)),
    readContentsBatch: (teamIds) => Promise.resolve(teamIds.map(read)),
  };
};

export { createMemoryTeamStorage };
