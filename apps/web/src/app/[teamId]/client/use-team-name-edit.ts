"use client";

import { toast } from "@repo/ui/components/sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";

import { teamQueryKeys } from "@/hooks/use-team-query";
import { updateTeamName } from "@/lib/actions/member-actions";

type UseTeamNameEditArgs = {
  isAdmin: boolean;
  teamId: string;
  teamName: string;
};

const useTeamNameEdit = ({ isAdmin, teamId, teamName }: UseTeamNameEditArgs) => {
  const queryClient = useQueryClient();
  const [, startTransition] = useTransition();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingTeamName, setEditingTeamName] = useState("");

  const handleStartEditName = () => {
    setEditingTeamName(teamName);
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    if (!isAdmin) {
      return;
    }

    const trimmedName = editingTeamName.trim();
    setIsEditingName(false);

    if (trimmedName === teamName) {
      return;
    }

    startTransition(async () => {
      const result = await updateTeamName(teamId, trimmedName);
      if (result.success) {
        void queryClient.invalidateQueries({ queryKey: teamQueryKeys.team(teamId) });
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
  };

  return {
    displayName: isEditingName ? editingTeamName : teamName,
    handleCancelEditName,
    handleSaveName,
    handleStartEditName,
    isEditingName,
    setEditingTeamName,
  };
};

export { useTeamNameEdit };
