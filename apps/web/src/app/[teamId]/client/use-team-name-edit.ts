"use client";

import { toast } from "@repo/ui/components/sonner";
import { useState, useTransition } from "react";

import { updateTeamName } from "@/lib/actions/member-actions";

type UseTeamNameEditArgs = {
  isAdmin: boolean;
  onTeamNameUpdated: (name: string) => void;
  teamId: string;
  teamName: string;
};

const useTeamNameEdit = ({ isAdmin, onTeamNameUpdated, teamId, teamName }: UseTeamNameEditArgs) => {
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
        onTeamNameUpdated(trimmedName);
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
