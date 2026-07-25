"use client";

import { toast } from "@repo/ui/components/sonner";
import { captureException } from "@sentry/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";

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

const useMyTeams = (isAuthenticated: boolean) => {
  const queryClient = useQueryClient();
  const [processingArchive, setProcessingArchive] = useState<Set<string>>(new Set());

  const { data: myTeams = [], isLoading: isLoadingTeams } = useQuery({
    enabled: isAuthenticated,
    queryFn: async () => {
      const response = await fetch("/api/teams");
      if (!response.ok) {
        throw new Error("Failed to fetch teams");
      }
      const data = TeamsResponseSchema.parse(await response.json());
      return data.teams;
    },
    queryKey: ["my-teams"],
  });

  const handleToggleArchive = async (team: MyTeam, archive: boolean) => {
    setProcessingArchive((prev) => new Set(prev).add(team.teamId));
    try {
      const response = await fetch(`/api/teams/${team.teamId}/membership`, {
        body: JSON.stringify({ archived: archive }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      if (response.ok) {
        toast.success(archive ? "Workspace archived" : "Workspace restored");
        await queryClient.invalidateQueries({ queryKey: ["my-teams"] });
      } else {
        const body: unknown = await response.json().catch(() => null);
        const parsed = errorBodySchema.safeParse(body);
        toast.error(parsed.success ? parsed.data.error : "Failed to update workspace");
      }
    } catch (error) {
      captureException(error);
      toast.error("Failed to update workspace");
    }
    setProcessingArchive((prev) => {
      const next = new Set(prev);
      next.delete(team.teamId);
      return next;
    });
  };

  return {
    handleToggleArchive,
    isLoadingTeams,
    myTeams,
    processingArchive,
  };
};

export { useMyTeams };
