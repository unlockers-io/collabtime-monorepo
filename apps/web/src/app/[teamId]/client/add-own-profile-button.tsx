"use client";

import { Button } from "@repo/ui/components/button";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { useState } from "react";
import { toast } from "sonner";

import { useTeamWrite } from "@/hooks/use-team-write";
import { runWithCleanup } from "@/lib/run-with-cleanup";

export const AddOwnProfileButton = ({ teamId }: { teamId: string }) => {
  const [pending, setPending] = useState(false);
  const write = useTeamWrite(teamId);
  const ready = useClientReady();

  const add = async () => {
    setPending(true);
    await runWithCleanup(
      async () => {
        const result = await write.change("claimOwnSlot", {});

        if (!result.success) {
          toast.error(result.error);
        }
      },
      () => {
        setPending(false);
      },
    );
  };

  return (
    <Button
      disabled={!ready || pending}
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
