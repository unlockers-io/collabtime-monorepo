"use client";

import { toast } from "@repo/ui/components/sonner";
import { captureException } from "@sentry/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptimistic, useTransition } from "react";
import { z } from "zod";

import { queryKeys } from "@/lib/query-keys";

import type { MyTeam } from "./types";

const errorBodySchema = z.object({ error: z.string() });

const TeamSchema = z.object({
  archivedAt: z.string().nullable(),
  memberCount: z.number(),
  role: z.string(),
  spaceId: z.string().nullable(),
  teamId: z.string(),
  teamName: z.string(),
});

const TeamsResponseSchema = z.object({ teams: z.array(TeamSchema) });

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

  const { data: myTeams = [], isLoading: isLoadingTeams } = useQuery({
    queryFn: async () => {
      const response = await fetch("/api/teams");
      if (!response.ok) {
        throw new Error("Failed to fetch teams");
      }
      const data = TeamsResponseSchema.parse(await response.json());
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
          return;
        }

        const body: unknown = await response.json().catch(() => null);
        const parsed = errorBodySchema.safeParse(body);
        toast.error(parsed.success ? parsed.data.error : "Failed to update workspace");
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
    myTeams: optimisticTeams,
  };
};

export { useMyTeams };
