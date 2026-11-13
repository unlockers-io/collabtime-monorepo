import { randomUUID } from "node:crypto";

import { updateTag } from "next/cache";

import type { TeamRecord } from "@/types";

import type { TeamCommand } from "./team-commands";
import type { TeamEventKind } from "./team-events";
import { postgresTeamStorage, type TeamStorage } from "./team-storage";
import { UUIDSchema } from "./validation";

type TeamStoreDeps<TTransaction = undefined> = {
  createId: () => string;
  invalidateTeamName: (teamId: string) => void;
  storage: TeamStorage<TTransaction>;
};

type TeamSummary = { memberCount: number; name: string };

type TeamContentsFailure = { error: string; ok: false };

type TeamContentsResult<TValue> =
  | TeamContentsFailure
  | { ok: true; team: TeamRecord; value: TValue };

/** Runs in the command's transaction, after its contents are written. */
type AccessChange<TValue, TTransaction> = (
  value: TValue,
  transaction: TTransaction,
) => Promise<void>;

type ApplyTeamCommand<TTransaction> = <TValue>(
  teamId: string,
  command: TeamCommand<TValue>,
  changeAccess?: AccessChange<TValue, TTransaction>,
) => Promise<TeamContentsResult<TValue>>;

const isUuid = (value: string): boolean => UUIDSchema.safeParse(value).success;
const teamNameTag = (teamId: string): string => `team-name:${teamId}`;

const createTeamStore = <TTransaction>(deps: TeamStoreDeps<TTransaction>) => {
  /** Rejections are returned; a failed write throws and rolls the whole change back. */
  const applyTeamCommand: ApplyTeamCommand<TTransaction> = async (
    teamId,
    command,
    changeAccess,
  ) => {
    const applied = await deps.storage.transaction(teamId, async (transaction) => {
      const events: Array<TeamEventKind> = [];
      const team = isUuid(teamId) ? await deps.storage.read(teamId, transaction) : null;

      if (team === null) {
        return { events, outcome: { error: "Team not found", ok: false as const }, renamed: false };
      }

      const outcome = command(team, { createId: deps.createId });

      if (!outcome.ok) {
        return { events, outcome, renamed: false };
      }

      const changed = JSON.stringify(outcome.team) !== JSON.stringify(team);

      if (changed) {
        await deps.storage.write(teamId, outcome.team, transaction);
      }

      if (changed || changeAccess) {
        events.push("contents");
      }

      if (changeAccess) {
        await changeAccess(outcome.value, transaction);
        events.push("space");
      }

      return { events, outcome, renamed: outcome.team.name !== team.name };
    });

    if (applied.events.length > 0) {
      await deps.storage.publish(teamId, applied.events);
    }

    if (applied.renamed) {
      deps.invalidateTeamName(teamId);
    }

    return applied.outcome;
  };

  const changeTeamAccess = async (
    teamId: string,
    change: (transaction: TTransaction) => Promise<void>,
  ): Promise<void> => {
    await deps.storage.transaction(teamId, change);
    await deps.storage.publish(teamId, ["space"]);
  };

  const createTeamContents = async (
    teamId: string,
    team: TeamRecord,
  ): Promise<TeamContentsFailure | { ok: true }> => {
    return deps.storage.transaction(teamId, async (transaction) => {
      if (await deps.storage.read(teamId, transaction)) {
        return { error: "Team already exists", ok: false };
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
    applyTeamCommand,
    changeTeamAccess,
    createTeamContents,
    readTeamRecord,
    readTeamSummaries,
    readTeamSummary,
  };
};

const { applyTeamCommand, changeTeamAccess, readTeamRecord, readTeamSummaries, readTeamSummary } =
  createTeamStore({
    createId: randomUUID,
    invalidateTeamName: (teamId) => {
      updateTag(teamNameTag(teamId));
    },
    storage: postgresTeamStorage,
  });

export {
  applyTeamCommand,
  changeTeamAccess,
  createTeamStore,
  readTeamRecord,
  readTeamSummaries,
  readTeamSummary,
  teamNameTag,
};

export type { AccessChange, ApplyTeamCommand, TeamContentsFailure, TeamStoreDeps };
