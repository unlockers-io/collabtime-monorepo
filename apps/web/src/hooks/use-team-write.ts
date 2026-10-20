"use client";

import { captureException } from "@sentry/nextjs";
import { MutationObserver, type QueryClient, useQueryClient } from "@tanstack/react-query";

import type { ActionResult } from "@/lib/actions/types";
import { queryKeys, teamMutationKey } from "@/lib/query-keys";
import { beginTeamWrite } from "@/lib/team-query-sync";
import type { Team } from "@/types";

import type { TeamQueryData } from "./use-team-query";

type TeamWrite<T> = {
  optimistic?: (team: Team) => Team;
  submit: () => Promise<ActionResult<T>>;
};

type OptimisticSnapshot = {
  previous: TeamQueryData | undefined;
  written: TeamQueryData | undefined;
};

const writeTeam = async <T>(
  queryClient: QueryClient,
  teamId: string,
  { optimistic, submit }: TeamWrite<T>,
): Promise<ActionResult<T>> => {
  const queryKey = queryKeys.teams.detail(teamId);
  const mutationKey = teamMutationKey(teamId);
  const observer = new MutationObserver<
    ActionResult<T>,
    Error,
    void,
    OptimisticSnapshot | undefined
  >(queryClient, {
    mutationFn: submit,
    mutationKey,
    // Server actions report their own network failures; never park them as paused.
    networkMode: "always",
    onMutate: async () => {
      if (!optimistic) {
        return undefined;
      }
      // Must be awaited before the write: cancelQueries reverts to the
      // pre-fetch state, which would undo an edit applied first.
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TeamQueryData>(queryKey);
      const written = queryClient.setQueryData<TeamQueryData>(
        queryKey,
        (data) => data && { team: optimistic(data.team) },
      );
      return { previous, written };
    },
    onSettled: (result, _error, _variables, snapshot) => {
      // A later write or fetch owns the cache once it no longer holds our patch.
      const failed = result?.success !== true;
      if (failed && snapshot && queryClient.getQueryData(queryKey) === snapshot.written) {
        queryClient.setQueryData(queryKey, snapshot.previous);
      }
    },
  });

  const finishWrite = beginTeamWrite(queryClient, teamId);
  try {
    return await observer.mutate();
  } catch (error) {
    captureException(error);
    return {
      error: "Could not save your changes. Check your connection and try again.",
      success: false,
    };
  } finally {
    observer.reset();
    // Mutation callbacks keep the mutation pending until they return.
    await finishWrite();
  }
};

const useTeamWrite = (teamId: string) => {
  const queryClient = useQueryClient();
  return <T>(write: TeamWrite<T>) => writeTeam(queryClient, teamId, write);
};

export { useTeamWrite };
