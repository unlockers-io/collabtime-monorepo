"use client";
import { Button } from "@repo/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { createOwnMemberSlot } from "@/lib/actions/member-actions";
import { queryKeys } from "@/lib/query-keys";

export const AddOwnProfileButton = ({ teamId }: { teamId: string }) => {
  const [pending, setPending] = useState(false);
  const queryClient = useQueryClient();
  const add = async () => {
    setPending(true);
    try {
      const result = await createOwnMemberSlot(teamId);
      if (!result.success) {
        toast.error(result.error);
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(teamId) });
    } catch {
      toast.error("Could not add your profile. Try again.");
    } finally {
      setPending(false);
    }
  };
  return (
    <Button
      disabled={pending}
      onClick={() => {
        void add();
      }}
      size="sm"
      variant="outline"
    >
      {pending ? "Adding…" : "Add your profile"}
    </Button>
  );
};
