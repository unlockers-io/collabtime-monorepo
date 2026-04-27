"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateTeamName } from "@/lib/actions/member-actions";

type UseTeamNameEditArgs = {
  isAdmin: boolean;
  teamId: string;
  teamName: string;
};

const useTeamNameEdit = ({ isAdmin, teamId, teamName }: UseTeamNameEditArgs) => {
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
      if (!result.success) {
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
