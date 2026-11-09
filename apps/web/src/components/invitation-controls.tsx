"use client";

import { Button } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui/components/spinner";
import { RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useInvitationWrites } from "@/hooks/use-invitation-writes";

type InvitationWrites = ReturnType<typeof useInvitationWrites>;

type Props = {
  invitation: { email: string; id: string };
  resend: InvitationWrites["resend"];
  revoke: InvitationWrites["revoke"];
};

export const InvitationControlsView = ({ invitation, resend, revoke }: Props) => {
  const [action, setAction] = useState<"resend" | "revoke" | null>(null);

  const run = async (next: "resend" | "revoke") => {
    setAction(next);

    if (next === "resend") {
      const result = await resend(invitation.id);

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
      const result = await revoke(invitation.id);

      if (result.success) {
        toast.success("Invitation revoked");
      } else {
        toast.error(result.error);
      }
    }

    setAction(null);
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
  const { resend, revoke } = useInvitationWrites(teamId);

  return <InvitationControlsView invitation={invitation} resend={resend} revoke={revoke} />;
};
