"use client";

import { captureException } from "@sentry/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { readApiError } from "@/lib/api-error";
import { type MyTeam, MyTeamsResponseSchema } from "@/lib/home-lists";
import { queryKeys } from "@/lib/query-keys";

type ArchiveUpdate = {
  archivedAt: string | null;
  teamId: string;
};

const applyArchive = (teams: Array<MyTeam>, update: ArchiveUpdate): Array<MyTeam> =>
  teams.map((team) =>
    team.teamId === update.teamId ? { ...team, archivedAt: update.archivedAt } : team,
  );

const useMyTeams = () => {
  const queryClient = useQueryClient();
  const [isArchivePending, startArchiveTransition] = useTransition();

  const {
    data: myTeams = [],
    isError: isTeamsError,
    isLoading: isLoadingTeams,
    refetch: refetchTeams,
  } = useQuery({
    queryFn: async () => {
      const response = await fetch("/api/teams");

      if (!response.ok) {
        throw new Error("Failed to fetch teams");
      }

      const data = MyTeamsResponseSchema.parse(await response.json());

      return data.teams;
    },
    queryKey: queryKeys.myTeams,
  });

  const [optimisticTeams, applyOptimisticArchive] = useOptimistic(myTeams, applyArchive);

  const handleToggleArchive = (team: MyTeam, archive: boolean) => {
    startArchiveTransition(async () => {
      applyOptimisticArchive({
        archivedAt: archive ? new Date().toISOString() : null,
        teamId: team.teamId,
      });

      try {
        const response = await fetch(`/api/teams/${team.teamId}/membership`, {
          body: JSON.stringify({ archived: archive }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });

        if (response.ok) {
          toast.success(archive ? "Workspace archived" : "Workspace restored");
          await queryClient.invalidateQueries({ queryKey: queryKeys.myTeams });
        } else {
          toast.error(await readApiError(response, "Failed to update workspace"));
        }
      } catch (error) {
        captureException(error);
        toast.error("Failed to update workspace");
      }
    });
  };

  return {
    handleToggleArchive,
    isArchivePending,
    isLoadingTeams,
    isTeamsError,
    myTeams: optimisticTeams,
    refetchTeams,
  };
};

export { useMyTeams };
