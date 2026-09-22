"use client";
import { Button } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui/components/spinner";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { resendInvitation, revokeInvitation } from "@/lib/actions/invitation-actions";
import { queryKeys } from "@/lib/query-keys";
import { runWithCleanup } from "@/lib/run-with-cleanup";

type Props = {
  invitation: { email: string; id: string };
  onSettled: () => void;
  resend: typeof resendInvitation;
  revoke: typeof revokeInvitation;
  teamId: string;
};
export const InvitationControlsView = ({
  invitation,
  onSettled,
  resend,
  revoke,
  teamId,
}: Props) => {
  const [action, setAction] = useState<"resend" | "revoke" | null>(null);
  const run = async (next: "resend" | "revoke") => {
    setAction(next);
    await runWithCleanup(
      async () => {
        try {
          if (next === "resend") {
            const result = await resend(teamId, invitation.id);
            if (result.success) {
              toast.success(
                result.data.emailSent
                  ? `Invitation sent to ${invitation.email}`
                  : "Invitation renewed, but email was not delivered",
              );
            } else {
              toast.error(result.error);
            }
          } else {
            const result = await revoke(teamId, invitation.id);
            if (result.success) {
              toast.success("Invitation revoked");
            } else {
              toast.error(result.error);
            }
          }
        } catch {
          toast.error("Could not update the invitation. Please try again.");
        }
      },
      () => {
        setAction(null);
        onSettled();
      },
    );
  };
  return (
    <div aria-busy={action !== null} className="flex shrink-0 gap-2">
      <Button
        aria-label={`Resend invitation to ${invitation.email}`}
        disabled={action !== null}
        onClick={() => {
          void run("resend");
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        {action === "resend" ? <Spinner /> : <RefreshCw className="size-4" />}Resend
      </Button>
      <Button
        aria-label={`Revoke invitation to ${invitation.email}`}
        disabled={action !== null}
        onClick={() => {
          void run("revoke");
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        {action === "revoke" ? <Spinner /> : <X className="size-4" />}Revoke
      </Button>
    </div>
  );
};
export const InvitationControls = ({
  invitation,
  teamId,
}: {
  invitation: { email: string; id: string };
  teamId: string;
}) => {
  const queryClient = useQueryClient();
  return (
    <InvitationControlsView
      invitation={invitation}
      onSettled={() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.teamInvitations(teamId) });
      }}
      resend={resendInvitation}
      revoke={revokeInvitation}
      teamId={teamId}
    />
  );
};
