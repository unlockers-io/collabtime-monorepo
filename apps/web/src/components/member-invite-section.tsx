"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { invitationSentMessage, useInvitationWrites } from "@/hooks/use-invitation-writes";
import { formatExpiresIn } from "@/lib/invitation-expiry";
import { runWithCleanup } from "@/lib/run-with-cleanup";
import { useNow } from "@/lib/use-tick";
import { InvitationEmailSchema } from "@/lib/validation";
import type { PendingTeamInvitation } from "@/types";

import { InvitationControls } from "./invitation-controls";

const emailError = (email: string): string | null => {
  const parsed = InvitationEmailSchema.safeParse(email);

  return parsed.success ? null : (parsed.error.issues[0]?.message ?? null);
};

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
  const invitations = useInvitationWrites(teamId);
  const formId = useId();
  const now = useNow();

  const send = async () => {
    hasAttempted.current = true;
    const parsed = InvitationEmailSchema.safeParse(email);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      focusFirstInvalidField(formId);

      return;
    }

    setPending(true);
    setError(null);
    await runWithCleanup(
      async () => {
        const result = await invitations.invite(memberId, parsed.data);

        if (!result.success) {
          setError(result.error);

          return;
        }

        toast.success(invitationSentMessage(parsed.data, result.data.emailSent));
        setEmail("");
        hasAttempted.current = false;
      },
      () => {
        setPending(false);
      },
    );
  };

  if (pendingInvite) {
    const expiry = formatExpiresIn(pendingInvite.expiresAt, now);

    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm break-all">Invited {pendingInvite.email}</p>
        {expiry !== null && <p className="text-xs text-muted-foreground">{expiry}</p>}
        <InvitationControls invitation={pendingInvite} teamId={teamId} />
      </div>
    );
  }

  const inputId = `${formId}-email`;
  const descriptionId = `${formId}-description`;
  const errorId = `${formId}-error`;

  return (
    <Field data-invalid={Boolean(error) || undefined} id={formId}>
      <FieldLabel htmlFor={inputId}>Invite by email</FieldLabel>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-describedby={error === null ? descriptionId : `${descriptionId} ${errorId}`}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          className="min-w-0 flex-1"
          id={inputId}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(hasAttempted.current ? emailError(event.target.value) : null);
          }}
          placeholder="name@company.com"
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
