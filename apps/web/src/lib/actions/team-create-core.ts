import type { authenticate } from "@/lib/team-auth";
import type { TeamMember, TeamRecord } from "@/types";

import { MAX_TEAMS_PER_USER } from "../limits";
import type { GrantMembership } from "../membership";
import type { TeamContentsFailureReason } from "../team-store";
import { TeamNameSchema } from "../validation";

import type { ActionErrorEvent, ActionResult } from "./types";

type StoreTeamResult = { ok: true } | { ok: false; reason: TeamContentsFailureReason };
type PopulateFailure = Omit<ActionErrorEvent, "route" | "teamId">;

type TeamCreateDeps = {
  authenticate: typeof authenticate;
  countAdminTeams: (userId: string) => Promise<number>;
  createId: () => string;
  createMember: (overrides: Partial<TeamMember>) => TeamMember;
  createSpace: (userId: string, teamId: string) => Promise<void>;
  deleteSpace: (teamId: string) => Promise<void>;
  grantMembership: GrantMembership;
  now: () => Date;
  reportError: (event: ActionErrorEvent) => void;
  storeTeam: (teamId: string, team: TeamRecord) => Promise<StoreTeamResult>;
};

const ROUTE = "actions/team-create";

const createTeamAction = (deps: TeamCreateDeps) => {
  const populateTeam = async (
    team: TeamRecord,
    creator: TeamMember,
    userId: string,
  ): Promise<PopulateFailure | null> => {
    try {
      const stored = await deps.storeTeam(team.id, team);
      if (!stored.ok) {
        return { message: "The new team's contents were not stored", reason: stored.reason };
      }

      const granted = await deps.grantMembership({
        role: "ADMIN",
        slot: { memberId: creator.id, name: creator.name },
        teamId: team.id,
        userId,
      });
      return granted.ok
        ? null
        : { message: "The creator's admin slot was not claimed", reason: granted.reason };
    } catch (error) {
      return { error, message: "Failed to populate the new team" };
    }
  };

  const rollBackSpace = async (teamId: string) => {
    try {
      await deps.deleteSpace(teamId);
    } catch (rollbackError) {
      deps.reportError({
        error: rollbackError,
        message: "Failed to roll back the Space row of an unfinished team",
        route: ROUTE,
        teamId,
      });
    }
  };

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

      await deps.createSpace(user.id, teamId);

      const creator = deps.createMember({ name: user.name ?? "", timezone, userId: user.id });
      const failure = await populateTeam(
        {
          createdAt: deps.now().toISOString(),
          groups: [],
          id: teamId,
          members: [creator],
          name: parsed.data,
        },
        creator,
        user.id,
      );

      if (failure !== null) {
        deps.reportError({ ...failure, route: ROUTE, teamId });
        await rollBackSpace(teamId);
        return { error: "Failed to create team", success: false };
      }

      return { data: teamId, success: true };
    } catch (error) {
      deps.reportError({ error, message: "Failed to create team", route: ROUTE });
      return { error: "Failed to create team", success: false };
    }
  };
};

export { createTeamAction };
