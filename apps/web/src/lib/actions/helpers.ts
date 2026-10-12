import type { z } from "zod";

import { log } from "@/lib/observability";
import type { TeamAccess } from "@/lib/team-auth";
import type { Team, TeamRecord } from "@/types";

import type { TeamCommand } from "../team-commands";
import { applyTeamCommand } from "../team-store";
import { UUIDSchema } from "../validation";

import type { ActionResult } from "./types";

type ActionFailure = Extract<ActionResult<never>, { success: false }>;

const sanitizeMemberUserId = (
  userId: string | undefined,
  currentUserId: string | undefined,
): { userId: string } | Record<string, never> => {
  if (userId === currentUserId) {
    return userId === undefined ? {} : { userId };
  }
  if (userId !== undefined && userId !== "") {
    return { userId: "claimed" };
  }
  return {};
};

const sanitizeTeam = (team: TeamRecord, currentUserId?: string): Team => {
  const { adminPasswordHash: _, ...publicTeam } = team;
  return {
    ...publicTeam,
    members: publicTeam.members.map(({ membershipRevision: _revision, userId, ...member }) =>
      Object.assign(member, sanitizeMemberUserId(userId, currentUserId)),
    ),
  };
};

type ErrorEvent = Parameters<typeof log.error>[0];
type Mutation<TValue> = { team: TeamRecord; value: TValue };

type MutateTeamArgs<TValue> = {
  access: TeamAccess;
  command: TeamCommand<TValue>;
  errorContext: string;
};

type TeamMutatorDeps = {
  applyTeamCommand: typeof applyTeamCommand;
  reportError: (event: ErrorEvent) => void;
};

type MutateTeam = <TValue>(args: MutateTeamArgs<TValue>) => Promise<ActionResult<Mutation<TValue>>>;

const createTeamMutator = (deps: TeamMutatorDeps): MutateTeam =>
  async function mutateTeam<TValue>({ access, command, errorContext }: MutateTeamArgs<TValue>) {
    try {
      const applied = await deps.applyTeamCommand(access.teamId, command);

      if (!applied.ok) {
        return {
          error: applied.reason === "write-failed" ? `Failed to ${errorContext}` : applied.error,
          success: false,
        };
      }

      return { data: { team: applied.team, value: applied.value }, success: true };
    } catch (error) {
      deps.reportError({ error, message: `Failed to ${errorContext}`, route: "actions/helpers" });
      return { error: `Failed to ${errorContext}`, success: false };
    }
  };

const mutateTeam = createTeamMutator({ applyTeamCommand, reportError: log.error });

const sanitizedTeam = (
  result: ActionResult<Mutation<unknown>>,
  currentUserId?: string,
): ActionResult<Team> =>
  result.success ? { data: sanitizeTeam(result.data.team, currentUserId), success: true } : result;

const parsedInput = <TOutput>(
  result: z.ZodSafeParseResult<TOutput>,
  fallback: string,
): ActionResult<TOutput> =>
  result.success
    ? { data: result.data, success: true }
    : { error: result.error.issues[0]?.message ?? fallback, success: false };

const invalidUuid = (value: string, label: string): ActionFailure | null =>
  UUIDSchema.safeParse(value).success ? null : { error: `Invalid ${label}`, success: false };

export { createTeamMutator, invalidUuid, mutateTeam, parsedInput, sanitizedTeam, sanitizeTeam };
export type { MutateTeam, TeamMutatorDeps };
