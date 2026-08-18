import type { requireAuth } from "@/lib/team-auth";
import type { TeamMember, TeamRecord } from "@/types";

import { TEAM_INITIAL_TTL_SECONDS } from "../redis";

import type { ActionErrorEvent, ActionResult } from "./types";

type StoreTeamResult =
  | { ok: true }
  | { ok: false; reason: "read-failed" | "rejected" | "unconfigured" | "write-failed" };

type TeamCreateDeps = {
  createId: () => string;
  createMember: (overrides: Partial<TeamMember>) => TeamMember;
  createTeamRecords: (userId: string, teamId: string) => Promise<void>;
  deleteSpace: (teamId: string) => Promise<void>;
  now: () => Date;
  reportError: (event: ActionErrorEvent) => void;
  requireAuth: typeof requireAuth;
  storeTeam: (teamId: string, team: TeamRecord, ttlSeconds: number) => Promise<StoreTeamResult>;
};

const createTeamAction = (deps: TeamCreateDeps) => {
  return async (timezone: string): Promise<ActionResult<string>> => {
    try {
      const session = await deps.requireAuth();
      const teamId = deps.createId();

      await deps.createTeamRecords(session.user.id, teamId);

      const team: TeamRecord = {
        createdAt: deps.now().toISOString(),
        groups: [],
        id: teamId,
        members: [
          deps.createMember({ name: session.user.name ?? "", timezone, userId: session.user.id }),
        ],
        name: "",
      };
      const applied = await deps.storeTeam(teamId, team, TEAM_INITIAL_TTL_SECONDS);

      if (!applied.ok) {
        deps.reportError({
          message: "Space and membership committed but the team contents were not stored",
          reason: applied.reason,
          route: "actions/team-create",
          teamId,
        });

        try {
          await deps.deleteSpace(teamId);
        } catch (rollbackError) {
          deps.reportError({
            error: rollbackError,
            message: "Failed to roll back the Space row for a team with no contents",
            route: "actions/team-create",
            teamId,
          });
        }

        return { error: "Failed to create team", success: false };
      }

      return { data: teamId, success: true };
    } catch (error) {
      deps.reportError({ error, message: "Failed to create team", route: "actions/team-create" });
      return { error: "Failed to create team", success: false };
    }
  };
};

export { createTeamAction };
