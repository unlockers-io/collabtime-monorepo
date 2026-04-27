"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import type { MyTeam } from "./types";

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
      const data = (await response.json()) as { teams: Array<MyTeam> };
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

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "Failed to update workspace");
        return;
      }

      toast.success(archive ? "Workspace archived" : "Workspace restored");
      await queryClient.invalidateQueries({ queryKey: ["my-teams"] });
    } catch {
      toast.error("Failed to update workspace");
    } finally {
      setProcessingArchive((prev) => {
        const next = new Set(prev);
        next.delete(team.teamId);
        return next;
      });
    }
  };

  return {
    handleToggleArchive,
    isLoadingTeams,
    myTeams,
    processingArchive,
  };
};

export { useMyTeams };
