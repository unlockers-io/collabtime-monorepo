import type { getSession } from "@/lib/auth-server";
import { canViewWorkspace } from "@/lib/workspace-access";
import type { WorkspaceAccessStore, WorkspaceSpace } from "@/lib/workspace-access";
import type { Team } from "@/types";

import type { readPublicTeam } from "../public-team";
import { UUIDSchema } from "../validation";

import type { ActionErrorEvent, ActionResult } from "./types";

type TeamReadDeps = {
  accessStore: WorkspaceAccessStore;
  findSpace: (teamId: string) => Promise<WorkspaceSpace | null>;
  getSession: typeof getSession;
  readPublicTeam: typeof readPublicTeam;
  reportError: (event: ActionErrorEvent) => void;
};

const createTeamReadActions = (deps: TeamReadDeps) => {
  const getPublicTeam = async (teamId: string): Promise<ActionResult<Team>> => {
    try {
      const uuidResult = UUIDSchema.safeParse(teamId);

      if (!uuidResult.success) {
        return { error: "Invalid team ID", success: false };
      }

      const space = await deps.findSpace(teamId);

      if (!space) {
        return { error: "Team not found", success: false };
      }

      const session = await deps.getSession();
      const userId = session?.user.id;

      if (!(await canViewWorkspace(space, userId, deps.accessStore))) {
        return { error: "This team is private", success: false };
      }

      const team = await deps.readPublicTeam(teamId, userId);

      return team ? { data: team, success: true } : { error: "Team not found", success: false };
    } catch (error) {
      deps.reportError({
        error,
        message: "Failed to fetch public team",
        route: "actions/team-read",
      });

      return { error: "Failed to fetch team", success: false };
    }
  };

  return { getPublicTeam };
};

export { createTeamReadActions };
