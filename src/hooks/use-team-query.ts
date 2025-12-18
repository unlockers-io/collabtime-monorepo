"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeamByToken } from "@/lib/actions";
import type { Team, TeamRole } from "@/types";

type UseTeamQueryOptions = {
  teamId: string;
  token: string | null;
};

type TeamQueryData = {
  team: Team;
  role: TeamRole;
};

const teamQueryKeys = {
  all: ["teams"] as const,
  team: (teamId: string) => [...teamQueryKeys.all, teamId] as const,
};

const useTeamQuery = ({ teamId, token }: UseTeamQueryOptions) => {
  return useQuery<TeamQueryData | null>({
    queryKey: teamQueryKeys.team(teamId),
    queryFn: async () => {
      if (!token) return null;

      const result = await getTeamByToken(token, teamId);
      if (!result.success) {
        throw new Error(result.error);
      }

      return {
        team: result.data.team,
        role: result.data.role,
      };
    },
    enabled: Boolean(token),
    // Refetch on window focus is handled by QueryProvider defaults
    // But we also want to refetch every 2 minutes as a fallback
    refetchInterval: 2 * 60 * 1000,
  });
};

const useInvalidateTeam = () => {
  const queryClient = useQueryClient();

  return (teamId: string) => {
    queryClient.invalidateQueries({ queryKey: teamQueryKeys.team(teamId) });
  };
};

const useUpdateTeamCache = () => {
  const queryClient = useQueryClient();

  return (teamId: string, updater: (data: TeamQueryData | null) => TeamQueryData | null) => {
    queryClient.setQueryData<TeamQueryData | null>(teamQueryKeys.team(teamId), (prev) =>
      updater(prev ?? null)
    );
  };
};

export { teamQueryKeys, useInvalidateTeam, useTeamQuery, useUpdateTeamCache };
export type { TeamQueryData };
