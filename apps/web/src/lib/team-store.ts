import { updateTag } from "next/cache";
import { v4 as uuidv4 } from "uuid";

import { log } from "@/lib/observability";
import type { TeamRecord } from "@/types";

import type { TeamCommand } from "./team-commands";
import { postgresTeamStorage, type TeamStorage } from "./team-storage";
import { UUIDSchema } from "./validation";

type TeamStoreDeps<TTransaction = undefined> = {
  createId: () => string;
  invalidateTeamName: (teamId: string) => void;
  reportError: (event: Parameters<typeof log.error>[0]) => void;
  storage: TeamStorage<TTransaction>;
};
type TeamContentsFailureReason = "rejected" | "write-failed";
type TeamSummary = { memberCount: number; name: string };
type TeamContentsFailure = { error: string; ok: false; reason: TeamContentsFailureReason };
type TeamContentsResult<TValue> =
  | TeamContentsFailure
  | { ok: true; team: TeamRecord; value: TValue };
type ApplyTeamCommand<TTransaction> = <TValue>(
  teamId: string,
  command: TeamCommand<TValue>,
  transaction: TTransaction,
) => Promise<TeamContentsResult<TValue>>;
const isUuid = (value: string): boolean => UUIDSchema.safeParse(value).success;
const teamNameTag = (teamId: string): string => `team-name:${teamId}`;

const createTeamStore = <TTransaction>(deps: TeamStoreDeps<TTransaction>) => {
  const applyInTransaction: ApplyTeamCommand<TTransaction> = async (
    teamId,
    command,
    transaction,
  ) => {
    const team = isUuid(teamId) ? await deps.storage.read(teamId, transaction) : null;
    if (team === null) {
      return { error: "Team not found", ok: false, reason: "rejected" };
    }
    const outcome = command(team, { createId: deps.createId });
    if (!outcome.ok) {
      return { ...outcome, reason: "rejected" };
    }
    if (JSON.stringify(outcome.team) !== JSON.stringify(team)) {
      await deps.storage.write(teamId, outcome.team, transaction);
    }
    return outcome;
  };

  const applyTeamCommand = async <TValue>(
    teamId: string,
    command: TeamCommand<TValue>,
  ): Promise<TeamContentsResult<TValue>> => {
    try {
      const previous = { contents: "", name: "" };
      const outcome = await deps.storage.transaction(teamId, async (transaction) => {
        return applyInTransaction(
          teamId,
          (team, context) => {
            previous.contents = JSON.stringify(team);
            previous.name = team.name;
            return command(team, context);
          },
          transaction,
        );
      });
      if (outcome.ok && JSON.stringify(outcome.team) !== previous.contents) {
        await deps.storage.publish(teamId);
        if (outcome.team.name !== previous.name) {
          deps.invalidateTeamName(teamId);
        }
      }
      return outcome;
    } catch (error) {
      deps.reportError({
        error,
        message: "Failed to save the team",
        route: "lib/team-store",
        teamId,
      });
      return { error: "Failed to save the team", ok: false, reason: "write-failed" };
    }
  };

  const createTeamContents = async (
    teamId: string,
    team: TeamRecord,
  ): Promise<TeamContentsFailure | { ok: true }> => {
    return deps.storage.transaction(teamId, async (transaction) => {
      if (await deps.storage.read(teamId, transaction)) {
        return { error: "Team already exists", ok: false, reason: "rejected" };
      }
      await deps.storage.write(teamId, team, transaction);
      return { ok: true };
    });
  };

  const readTeamRecord = async (teamId: string): Promise<TeamRecord | null> => {
    if (!isUuid(teamId)) {
      return null;
    }
    return deps.storage.read(teamId);
  };
  const readTeamSummaries = async (teamIds: Array<string>): Promise<Map<string, TeamSummary>> => {
    const wanted = [...new Set(teamIds)].filter(isUuid);
    const teams = wanted.length === 0 ? [] : await deps.storage.readBatch(wanted);
    return new Map(
      teams.map((team) => [team.id, { memberCount: team.members.length, name: team.name }]),
    );
  };
  const readTeamSummary = async (teamId: string): Promise<TeamSummary | null> => {
    const summaries = await readTeamSummaries([teamId]);
    return summaries.get(teamId) ?? null;
  };
  return {
    applyInTransaction,
    applyTeamCommand,
    createTeamContents,
    readTeamRecord,
    readTeamSummaries,
    readTeamSummary,
  };
};
const { applyInTransaction, applyTeamCommand, readTeamRecord, readTeamSummaries, readTeamSummary } =
  createTeamStore({
    createId: uuidv4,
    invalidateTeamName: (teamId) => {
      updateTag(teamNameTag(teamId));
    },
    reportError: log.error,
    storage: postgresTeamStorage,
  });
export {
  applyInTransaction,
  applyTeamCommand,
  createTeamStore,
  readTeamRecord,
  readTeamSummaries,
  readTeamSummary,
  teamNameTag,
};
export type {
  ApplyTeamCommand,
  TeamContentsFailure,
  TeamContentsFailureReason,
  TeamContentsResult,
  TeamStoreDeps,
};
