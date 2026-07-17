"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getPublicTeam } from "@/lib/actions/team-read";
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

const useUpdateTeamCache = () => {
  const queryClient = useQueryClient();

  return (teamId: string, updater: (data: TeamQueryData | null) => TeamQueryData | null) => {
    queryClient.setQueryData<TeamQueryData | null>(teamQueryKeys.team(teamId), (prev) =>
      updater(prev ?? null),
    );
  };
};

export { teamQueryKeys, useTeamQuery, useUpdateTeamCache };
