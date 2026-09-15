"use client";
import { Button } from "@repo/ui/components/button";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { toast } from "@repo/ui/components/sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

import { inviteMember } from "@/lib/actions/invitation-actions";
import { formatExpiresIn } from "@/lib/invitation-expiry";
import { queryKeys } from "@/lib/query-keys";
import { InvitationEmailSchema, normalizeEmail } from "@/lib/validation";
import type { PendingTeamInvitation } from "@/types";

import { InvitationControls } from "./invitation-controls";

export const MemberInviteSection = ({
  memberId,
  pendingInvite,
  teamId,
}: {
  memberId: string;
  pendingInvite?: PendingTeamInvitation;
  teamId: string;
}) => {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const id = useId();
  const send = async () => {
    const parsed = InvitationEmailSchema.safeParse(normalizeEmail(email));
    if (!parsed.success) {
      setError("Enter a valid email address");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await inviteMember(teamId, memberId, parsed.data);
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success(
        result.data.emailSent
          ? `Invitation sent to ${parsed.data}`
          : `Invitation created for ${parsed.data} (email was not delivered)`,
      );
      setEmail("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.teamInvitations(teamId) });
    } catch {
      setError("Could not send the invitation. Try again.");
    } finally {
      setPending(false);
    }
  };
  if (pendingInvite) {
    return (
      <div className="flex flex-col gap-3 border-t border-border py-4">
        <p className="text-sm break-all">Invited: {pendingInvite.email}</p>
        {pendingInvite.expiresAt !== null && (
          <p className="text-xs text-muted-foreground">
            {formatExpiresIn(pendingInvite.expiresAt)}
          </p>
        )}
        <InvitationControls invitation={pendingInvite} teamId={teamId} />
      </div>
    );
  }
  return (
    <div className="border-t border-border py-4">
      <Field data-invalid={Boolean(error) || undefined}>
        <FieldLabel htmlFor={id}>Invite User</FieldLabel>
        <div className="flex flex-wrap gap-2">
          <Input
            aria-describedby={error === null ? undefined : `${id}-error`}
            aria-invalid={Boolean(error)}
            autoComplete="email"
            className="min-w-0 flex-1"
            id={id}
            onBlur={() => {
              if (email && !InvitationEmailSchema.safeParse(normalizeEmail(email)).success) {
                setError("Enter a valid email address");
              }
            }}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(null);
            }}
            type="email"
            value={email}
          />
          <Button
            aria-label="Send invitation"
            disabled={pending || !email.trim()}
            onClick={() => {
              void send();
            }}
            type="button"
            variant="outline"
          >
            {pending ? "Sending…" : "Send invitation"}
          </Button>
        </div>
        {error !== null && <FieldError errors={[error]} id={`${id}-error`} />}
      </Field>
    </div>
  );
};
