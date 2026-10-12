"use client";
import { Button } from "@repo/ui/components/button";
import { useState } from "react";
import { toast } from "sonner";

import { useTeamWrite } from "@/hooks/use-team-cache";
import { createOwnMemberSlot } from "@/lib/actions/member-actions";
import { runWithCleanup } from "@/lib/run-with-cleanup";

export const AddOwnProfileButton = ({ teamId }: { teamId: string }) => {
  const [pending, setPending] = useState(false);
  const writeTeam = useTeamWrite(teamId);
  const add = async () => {
    setPending(true);
    await runWithCleanup(
      async () => {
        try {
          const result = await writeTeam({ submit: () => createOwnMemberSlot(teamId) });
          if (!result.success) {
            toast.error(result.error);
          }
        } catch {
          toast.error("Could not add your profile. Try again.");
        }
      },
      () => {
        setPending(false);
      },
    );
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
