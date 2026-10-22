"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { inviteMember } from "@/lib/actions/invitation-actions";
import { formatExpiresIn } from "@/lib/invitation-expiry";
import { queryKeys } from "@/lib/query-keys";
import { runWithCleanup } from "@/lib/run-with-cleanup";
import { InvitationEmailSchema, normalizeEmail } from "@/lib/validation";
import type { PendingTeamInvitation } from "@/types";

import { InvitationControls } from "./invitation-controls";

const INVALID_EMAIL = "Enter a valid email address";

const isValidEmail = (email: string) =>
  InvitationEmailSchema.safeParse(normalizeEmail(email)).success;

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
  const hasAttempted = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const id = useId();
  const send = async () => {
    hasAttempted.current = true;
    const parsed = InvitationEmailSchema.safeParse(normalizeEmail(email));
    if (!parsed.success) {
      setError(INVALID_EMAIL);
      inputRef.current?.focus();
      return;
    }
    setPending(true);
    setError(null);
    await runWithCleanup(
      async () => {
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
          hasAttempted.current = false;
          await queryClient.invalidateQueries({ queryKey: queryKeys.teamInvitations(teamId) });
        } catch {
          setError("Could not send the invitation. Try again.");
        }
      },
      () => {
        setPending(false);
      },
    );
  };
  if (pendingInvite) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm break-all">Invited {pendingInvite.email}</p>
        {pendingInvite.expiresAt !== null && (
          <p className="text-xs text-muted-foreground">
            {formatExpiresIn(pendingInvite.expiresAt)}
          </p>
        )}
        <InvitationControls invitation={pendingInvite} teamId={teamId} />
      </div>
    );
  }
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  return (
    <Field data-invalid={Boolean(error) || undefined}>
      <FieldLabel htmlFor={id}>Invite by email</FieldLabel>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-describedby={error === null ? descriptionId : `${descriptionId} ${errorId}`}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          className="min-w-0 flex-1"
          id={id}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(
              hasAttempted.current && !isValidEmail(event.target.value) ? INVALID_EMAIL : null,
            );
          }}
          placeholder="name@company.com"
          ref={inputRef}
          type="email"
          value={email}
        />
        <Button
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
      <FieldDescription id={descriptionId}>
        We&apos;ll email a link so they can claim this profile.
      </FieldDescription>
      {error !== null && <FormFieldError errors={[error]} id={errorId} />}
    </Field>
  );
};
