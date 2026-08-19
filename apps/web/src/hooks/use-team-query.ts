"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getPublicTeam } from "@/lib/actions/team-read";
import type { ActionResult } from "@/lib/actions/types";
import type { Team } from "@/types";

type UseTeamQueryOptions = {
  teamId: string;
};

type TeamQueryData = {
  team: Team;
};

const teamQueryKeys = {
  all: ["teams"] as const,
  team: (teamId: string) => [...teamQueryKeys.all, teamId] as const,
};

const useTeamQuery = ({ teamId }: UseTeamQueryOptions) => {
  return useQuery<TeamQueryData | null>({
    enabled: true,
    queryFn: async () => {
      const result = await getPublicTeam(teamId);
      if (!result.success) {
        throw new Error(result.error);
      }

      return {
        team: result.data.team,
      };
    },
    queryKey: teamQueryKeys.team(teamId),
    refetchInterval: 20 * 1000,
    refetchIntervalInBackground: false,
  });
};

type TeamCacheUpdater = (data: TeamQueryData | null) => TeamQueryData | null;

type TeamMutationVariables = {
  optimistic: TeamCacheUpdater;
  submit: () => Promise<ActionResult<unknown>>;
};

const useTeamMutation = (teamId: string) => {
  const queryClient = useQueryClient();
  const queryKey = teamQueryKeys.team(teamId);

  return useMutation<ActionResult<unknown>, Error, TeamMutationVariables, { previous: unknown }>({
    mutationFn: async ({ submit }) => {
      const result = await submit();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onError: (_error, _variables, context) => {
      if (context) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onMutate: async ({ optimistic }) => {
      // Must be awaited before the write: cancelQueries reverts to the
      // pre-fetch state, which would undo an edit applied first.
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TeamQueryData | null>(queryKey) ?? null;
      queryClient.setQueryData<TeamQueryData | null>(queryKey, (prev) => optimistic(prev ?? null));
      return { previous };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
};

export { teamQueryKeys, useTeamMutation, useTeamQuery };
export type { TeamCacheUpdater };
