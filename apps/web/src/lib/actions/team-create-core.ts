import { prisma } from "@repo/db";

import type { authenticate } from "@/lib/team-auth";
import type { TeamMember, TeamRecord } from "@/types";

import { displayName } from "../display-name";
import { MAX_TEAMS_PER_USER } from "../limits";
import { membershipUpsert } from "../membership";
import { writeTeam } from "../team-postgres-repository";
import { withTeamTransaction } from "../team-storage";
import { DEFAULT_MEMBER_TIMEZONE } from "../timezones";
import { TeamNameSchema, TimezoneSchema } from "../validation";

import type { ActionErrorEvent, ActionResult } from "./types";

type TeamCreateDeps = {
  authenticate: typeof authenticate;
  createId: () => string;
  createMember: (overrides: Partial<TeamMember>) => TeamMember;
  now: () => Date;
  reportError: (event: ActionErrorEvent) => void;
};

const ROUTE = "actions/team-create";

/** The space, its contents and the creator's admin membership exist together or not at all. */
const persistTeam = (userId: string, team: TeamRecord): Promise<void> =>
  withTeamTransaction(team.id, async (transaction) => {
    await transaction.space.create({
      data: { isPrivate: false, ownerId: userId, teamId: team.id },
    });
    await writeTeam(team.id, team, transaction);
    await transaction.membership.upsert(
      membershipUpsert({ role: "ADMIN", teamId: team.id, userId }),
    );
  });

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

      const administered = await prisma.membership.count({
        where: { role: "ADMIN", userId: user.id },
      });

      if (administered >= MAX_TEAMS_PER_USER) {
        return {
          error: `You can administer up to ${MAX_TEAMS_PER_USER} workspaces`,
          success: false,
        };
      }

      const teamId = deps.createId();

      const zone = TimezoneSchema.safeParse(timezone);

      const creator = deps.createMember({
        name: displayName(user.name, user.email),
        timezone: zone.success ? zone.data : DEFAULT_MEMBER_TIMEZONE,
        userId: user.id,
      });

      await persistTeam(user.id, {
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
