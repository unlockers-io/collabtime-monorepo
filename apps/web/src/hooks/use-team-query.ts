"use client";

import { useQuery } from "@tanstack/react-query";

import { getPublicTeam } from "@/lib/actions/team-read";
import { queryKeys } from "@/lib/query-keys";
import type { Team } from "@/types";

type TeamQueryData = {
  team: Team;
};

const useTeamQuery = ({ isLive = false, teamId }: { isLive?: boolean; teamId: string }) =>
  useQuery<TeamQueryData>({
    queryFn: async () => {
      const result = await getPublicTeam(teamId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return { team: result.data.team };
    },
    queryKey: queryKeys.teams.detail(teamId),
    refetchInterval: isLive ? 5 * 60 * 1000 : 20 * 1000,
    refetchIntervalInBackground: false,
  });

export type { TeamQueryData };
export { useTeamQuery };
