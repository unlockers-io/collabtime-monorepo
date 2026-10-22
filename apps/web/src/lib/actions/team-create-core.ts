import type { authenticate } from "@/lib/team-auth";
import type { TeamMember, TeamRecord } from "@/types";

import { MAX_TEAMS_PER_USER } from "../limits";
import { TeamNameSchema } from "../validation";

import type { ActionErrorEvent, ActionResult } from "./types";

type TeamCreateDeps = {
  authenticate: typeof authenticate;
  countAdminTeams: (userId: string) => Promise<number>;
  createId: () => string;
  createMember: (overrides: Partial<TeamMember>) => TeamMember;
  now: () => Date;
  persistTeam: (userId: string, team: TeamRecord) => Promise<void>;
  reportError: (event: ActionErrorEvent) => void;
};

const ROUTE = "actions/team-create";

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

      const creator = deps.createMember({ name: user.name ?? "", timezone, userId: user.id });
      await deps.persistTeam(user.id, {
        createdAt: deps.now().toISOString(),
        groups: [],
        id: teamId,
        members: [creator],
        name: parsed.data,
      });

      return { data: teamId, success: true };
    } catch (error) {
      deps.reportError({ error, message: "Failed to create team", route: ROUTE });

      return { error: "Failed to create team", success: false };
    }
  };
};

export { createTeamAction };
