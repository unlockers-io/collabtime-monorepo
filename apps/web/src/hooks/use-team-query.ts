"use client";

import { useQuery } from "@tanstack/react-query";

import { getPublicTeam } from "@/lib/actions/team-read";
import { queryKeys } from "@/lib/query-keys";
import type { Team } from "@/types";

const useTeamQuery = ({ isLive, teamId }: { isLive: boolean; teamId: string }) =>
  useQuery<Team>({
    queryFn: async () => {
      const result = await getPublicTeam(teamId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    queryKey: queryKeys.team.contents(teamId),
    refetchInterval: isLive ? 5 * 60 * 1000 : 20 * 1000,
    refetchIntervalInBackground: false,
  });

export { useTeamQuery };
