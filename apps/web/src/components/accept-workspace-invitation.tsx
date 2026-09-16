"use client";

import { Button } from "@repo/ui/components/button";
import { captureException } from "@sentry/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { acceptInvitation, declineInvitation } from "@/lib/actions/invitation-actions";

const AcceptWorkspaceInvitation = ({
  invitationId,
  inviterName,
  teamName,
}: {
  invitationId: string;
  inviterName?: string;
  teamName?: string;
}) => {
  const { refresh } = useRouter();
  const [action, setAction] = useState<"accept" | "decline" | null>(null);
  const pending = action !== null;
  const [acceptError, setError] = useState<string | null>(null);
  const handleDecision = async (decision: "accept" | "decline") => {
    setAction(decision);
    setError(null);
    try {
      const result =
        decision === "accept"
          ? await acceptInvitation(invitationId)
          : await declineInvitation(invitationId);
      if (!result.success) {
        setError(result.error);
      }
      if (result.success) {
        toast.success(decision === "accept" ? "Invitation accepted" : "Invitation declined");
      }
      refresh();
    } catch (error) {
      captureException(error);
      setError("Couldn't update the invitation. Please try again.");
    } finally {
      setAction(null);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="font-medium">
        You&apos;ve been invited to{" "}
        {teamName === undefined || teamName === "" ? "this workspace" : teamName}
      </p>
      {inviterName !== undefined && inviterName !== "" && (
        <p className="text-sm text-muted-foreground">Invited by {inviterName}</p>
      )}
      {acceptError !== null && (
        <p className="text-sm text-destructive" role="alert">
          {acceptError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          className="self-start"
          disabled={pending}
          onClick={() => {
            void handleDecision("accept");
          }}
        >
          {action === "accept" ? "Accepting…" : "Accept invitation"}
        </Button>
        <Button
          disabled={pending}
          onClick={() => {
            void handleDecision("decline");
          }}
          variant="outline"
        >
          {action === "decline" ? "Declining…" : "Decline"}
        </Button>
      </div>
    </div>
  );
};

export { AcceptWorkspaceInvitation };
