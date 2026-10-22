"use client";

import { useQuery } from "@tanstack/react-query";

import { getPendingTeamInvitations } from "@/lib/actions/invitation-actions";
import { queryKeys } from "@/lib/query-keys";

export const usePendingTeamInvitations = (teamId: string, enabled = true) =>
  useQuery({
    enabled,
    queryFn: async () => {
      const result = await getPendingTeamInvitations(teamId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    queryKey: queryKeys.teamInvitations(teamId),
  });
