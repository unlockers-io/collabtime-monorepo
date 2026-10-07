import type { TeamSummary } from "./team-postgres-repository";
import type { TeamStorage } from "./team-storage";

const STALE = "stale";

const createMemoryTeamStorage = (): TeamStorage => {
  const contents = new Map<string, string>();
  const unmirrored = new Map<string, string>();
  const mirrored = new Map<string, TeamSummary>();

  return {
    compareAndSet: (teamId, expected, next, revision) => {
      if ((contents.get(teamId) ?? null) !== expected) {
        return Promise.resolve(false);
      }

      contents.set(teamId, next);
      unmirrored.set(teamId, revision);
      return Promise.resolve(true);
    },
    mirror: (teamId, team, revision) => {
      mirrored.set(teamId, { memberCount: team.members.length, name: team.name });

      if (unmirrored.get(teamId) === revision) {
        unmirrored.delete(teamId);
      } else {
        unmirrored.set(teamId, STALE);
      }

      return Promise.resolve();
    },
    publish: () => Promise.resolve(),
    readContents: (teamId) => Promise.resolve(contents.get(teamId) ?? null),
    readMirroredSummaries: (teamIds) =>
      Promise.resolve(
        new Map(
          teamIds.flatMap((teamId) => {
            const summary = mirrored.get(teamId);
            return summary === undefined || unmirrored.has(teamId)
              ? []
              : [[teamId, summary] as const];
          }),
        ),
      ),
  };
};

export { createMemoryTeamStorage };
