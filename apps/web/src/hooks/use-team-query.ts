"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPublicTeam, getTeamByToken } from "@/lib/actions";
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
      // If we have a token, use it to get admin access
      if (token) {
        const result = await getTeamByToken(token, teamId);
        if (result.success) {
          return {
            team: result.data.team,
            role: result.data.role,
          };
        }
        // Token invalid/expired, fall through to public access
      }

      // Public access (read-only)
      const result = await getPublicTeam(teamId);
      if (!result.success) {
        throw new Error(result.error);
      }

      return {
        team: result.data.team,
        role: result.data.role,
      };
    },
    // Always enabled since we can fetch publicly
    enabled: true,
    // Refetch on window focus is handled by QueryProvider defaults
    // But we also want to refetch every 2 minutes as a fallback
    refetchInterval: 2 * 60 * 1000,
  });
};

const useUpdateTeamCache = () => {
  const queryClient = useQueryClient();

  return (
    teamId: string,
    updater: (data: TeamQueryData | null) => TeamQueryData | null,
  ) => {
    queryClient.setQueryData<TeamQueryData | null>(
      teamQueryKeys.team(teamId),
      (prev) => updater(prev ?? null),
    );
  };
};

export { useTeamQuery, useUpdateTeamCache };
