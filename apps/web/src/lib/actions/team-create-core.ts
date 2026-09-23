import type { authenticate } from "@/lib/team-auth";
import type { TeamMember, TeamRecord } from "@/types";

import { MAX_TEAMS_PER_USER } from "../limits";
import { TEAM_INITIAL_TTL_SECONDS } from "../redis";
import { TeamNameSchema } from "../validation";

import type { ActionErrorEvent, ActionResult } from "./types";

type StoreTeamResult =
  | { ok: true }
  | { ok: false; reason: "read-failed" | "rejected" | "unconfigured" | "write-failed" };

type TeamCreateDeps = {
  authenticate: typeof authenticate;
  countAdminTeams: (userId: string) => Promise<number>;
  createId: () => string;
  createMember: (overrides: Partial<TeamMember>) => TeamMember;
  createTeamRecords: (userId: string, teamId: string) => Promise<void>;
  deleteSpace: (teamId: string) => Promise<void>;
  now: () => Date;
  reportError: (event: ActionErrorEvent) => void;
  storeTeam: (teamId: string, team: TeamRecord, ttlSeconds: number) => Promise<StoreTeamResult>;
};

const createTeamAction = (deps: TeamCreateDeps) => {
  return async (timezone: string, name: string): Promise<ActionResult<string>> => {
    const auth = await deps.authenticate();
    if (!auth.success) {
      return auth;
    }
    const user = auth.data;
    try {
      const parsed = TeamNameSchema.safeParse(name);
      if (!parsed.success) {
        return {
          error: parsed.error.issues[0]?.message ?? "Invalid workspace name",
          success: false,
        };
      }
      if ((await deps.countAdminTeams(user.id)) >= MAX_TEAMS_PER_USER) {
        return {
          error: `You can administer up to ${MAX_TEAMS_PER_USER} workspaces`,
          success: false,
        };
      }
      const teamId = deps.createId();

      await deps.createTeamRecords(user.id, teamId);

      const team: TeamRecord = {
        createdAt: deps.now().toISOString(),
        groups: [],
        id: teamId,
        members: [deps.createMember({ name: user.name ?? "", timezone, userId: user.id })],
        name: parsed.data,
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
