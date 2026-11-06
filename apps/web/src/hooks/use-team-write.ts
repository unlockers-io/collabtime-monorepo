"use client";

import { captureException } from "@sentry/nextjs";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";

import { changeTeam } from "@/lib/actions/team-change";
import type { ActionResult } from "@/lib/actions/types";
import { queryKeys } from "@/lib/query-keys";
import {
  parseTeamChange,
  type TeamChangeArgs,
  type TeamChangeName,
  type TeamChangeReply,
  teamChanges,
} from "@/lib/team-changes";
import type { TeamCommand } from "@/lib/team-commands";
import { beginTeamWrite } from "@/lib/team-query-sync";
import type { Team } from "@/types";

type TeamWrite<T> = {
  optimistic?: (team: Team) => Team;
  submit: () => Promise<ActionResult<T>>;
};

const UNREACHABLE = "Could not save your changes. Check your connection and try again.";

const keepCache = () => {};

const writeTeam = async <T>(
  queryClient: QueryClient,
  teamId: string,
  { optimistic, submit }: TeamWrite<T>,
): Promise<ActionResult<T>> => {
  const queryKey = queryKeys.team.contents(teamId);
  const finishWrite = beginTeamWrite(queryClient, teamId);
  let rollback = keepCache;

  try {
    if (optimistic) {
      // Must be awaited before the write: cancelQueries reverts to the
      // pre-fetch state, which would undo an edit applied first.
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Team>(queryKey);
      const written = queryClient.setQueryData<Team>(queryKey, (team) => team && optimistic(team));

      rollback = () => {
        // A later write or fetch owns the cache once it no longer holds our patch.
        if (queryClient.getQueryData(queryKey) === written) {
          queryClient.setQueryData(queryKey, previous);
        }
      };
    }

    const result = await submit();

    if (!result.success) {
      rollback();
    }

    return result;
  } catch (error) {
    captureException(error);
    rollback();

    return { error: UNREACHABLE, success: false };
  } finally {
    await finishWrite();
  }
};

const applyCommand =
  <TValue>(command: TeamCommand<TValue>) =>
  (team: Team): Team => {
    const outcome = command(team, { createId: () => crypto.randomUUID() });

    return outcome.ok ? outcome.team : team;
  };

const useTeamWrite = (teamId: string) => {
  const queryClient = useQueryClient();

  const change = async <TName extends TeamChangeName>(
    name: TName,
    args: TeamChangeArgs<TName>,
  ): Promise<ActionResult<TeamChangeReply<TName>>> => {
    const parsed = parseTeamChange(name, args);

    if (!parsed.ok) {
      return { error: parsed.error, success: false };
    }

    const { preview } = teamChanges[name];

    return writeTeam(queryClient, teamId, {
      optimistic: preview ? applyCommand(preview(parsed.args)) : undefined,
      submit: () => changeTeam(teamId, name, args),
    });
  };

  const run = <T>(submit: () => Promise<ActionResult<T>>) =>
    writeTeam(queryClient, teamId, { submit });

  return { change, run };
};

export { useTeamWrite, writeTeam };
