import type { getSession } from "@/lib/auth-server";
import { SPACE_ACCESS_COOKIE_PREFIX } from "@/lib/space-access";
import type { getTeamRole } from "@/lib/team-auth";
import type { Team, TeamRole } from "@/types";

import type { readTeamRecord, readTeamSummary } from "../team-store";
import { UUIDSchema } from "../validation";

import { sanitizeTeam } from "./helpers";
import type { ActionErrorEvent, ActionResult } from "./types";

type TeamReadDeps = {
  findSpace: (
    teamId: string,
  ) => Promise<{ accessPassword: string | null; id: string; isPrivate: boolean } | null>;
  getAccessToken: (cookieName: string) => Promise<string | undefined>;
  getSession: typeof getSession;
  getTeamRole: typeof getTeamRole;
  readTeamRecord: typeof readTeamRecord;
  readTeamSummary: typeof readTeamSummary;
  reportError: (event: ActionErrorEvent) => void;
  verifyAccessToken: (token: string, spaceId: string, accessPassword: string | null) => boolean;
};

const createTeamReadActions = (deps: TeamReadDeps) => {
  const getTeamMembershipRole = async (teamId: string): Promise<TeamRole | null> => {
    try {
      const uuidResult = UUIDSchema.safeParse(teamId);
      if (!uuidResult.success) {
        return null;
      }

      const result = await deps.getTeamRole(teamId);
      return result?.role ?? null;
    } catch (error) {
      deps.reportError({
        error,
        message: "Failed to get membership role",
        route: "actions/team-read",
      });
      return null;
    }
  };

  const getPublicTeam = async (teamId: string): Promise<ActionResult<{ team: Team }>> => {
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

      if (space.isPrivate) {
        const memberRole = await getTeamMembershipRole(teamId);
        if (!memberRole) {
          const accessToken = await deps.getAccessToken(`${SPACE_ACCESS_COOKIE_PREFIX}${space.id}`);
          const hasGuestAccess =
            accessToken !== undefined && accessToken !== ""
              ? deps.verifyAccessToken(accessToken, space.id, space.accessPassword)
              : false;
          if (!hasGuestAccess) {
            return { error: "This team is private", success: false };
          }
        }
      }

      const team = await deps.readTeamRecord(teamId);
      if (!team) {
        return { error: "Team not found", success: false };
      }

      return { data: { team: sanitizeTeam(team, userId) }, success: true };
    } catch (error) {
      deps.reportError({
        error,
        message: "Failed to fetch public team",
        route: "actions/team-read",
      });
      return { error: "Failed to fetch team", success: false };
    }
  };

  const validateTeam = async (teamId: string): Promise<boolean> => {
    try {
      const uuidResult = UUIDSchema.safeParse(teamId);
      if (!uuidResult.success) {
        return false;
      }

      const space = await deps.findSpace(teamId);
      return space !== null;
    } catch (error) {
      deps.reportError({ error, message: "Failed to validate team", route: "actions/team-read" });
      return false;
    }
  };

  const getTeamName = async (teamId: string): Promise<string | null> => {
    try {
      const summary = await deps.readTeamSummary(teamId);
      const name = summary?.name.trim() ?? "";
      return name.length > 0 ? name : null;
    } catch (error) {
      deps.reportError({ error, message: "Failed to get team name", route: "actions/team-read" });
      return null;
    }
  };

  return { getPublicTeam, getTeamMembershipRole, getTeamName, validateTeam };
};

export { createTeamReadActions };
