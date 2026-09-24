"use client";

import { Button } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui/components/spinner";
import { Check, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";

import { SectionCard, SectionCardHeader, SectionCardTitle } from "@/components/section-card";
import { formatExpiresIn } from "@/lib/invitation-expiry";
import type { PendingInvitation } from "@/types";

type InvitationsListProps = {
  invitations: Array<PendingInvitation>;
  isPending: boolean;
  onAccept: (invitation: PendingInvitation) => void;
  onDecline: (invitation: PendingInvitation) => void;
};

const InvitationsList = ({ invitations, isPending, onAccept, onDecline }: InvitationsListProps) => {
  if (invitations.length === 0) {
    return null;
  }

  return (
    <SectionCard>
      <SectionCardHeader>
        <SectionCardTitle>Pending invitations</SectionCardTitle>
      </SectionCardHeader>
      <ul className="flex flex-col divide-y divide-border">
        {/* Rows only animate when one is answered, never on page load. */}
        <AnimatePresence initial={false} mode="popLayout">
          {invitations.map((invitation) => (
            <m.li
              animate={{ opacity: 1 }}
              className="flex min-h-20 items-center justify-between gap-4 py-4"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key={invitation.id}
              layout
              transition={{ duration: 0.12 }}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-display text-xl font-semibold tracking-display text-foreground">
                  {invitation.teamName}
                </span>
                <span className="text-xs text-muted-foreground">
                  Invited by {invitation.inviterName}
                  {invitation.expiresAt !== null && ` · ${formatExpiresIn(invitation.expiresAt)}`}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  aria-label={`Decline invitation to ${invitation.teamName}`}
                  disabled={isPending}
                  onClick={() => {
                    onDecline(invitation);
                  }}
                  size="sm"
                  variant="ghost"
                >
                  {isPending ? <Spinner className="size-4" /> : <X className="size-4" />}
                </Button>
                <Button
                  aria-label={`Accept invitation to ${invitation.teamName}`}
                  disabled={isPending}
                  onClick={() => {
                    onAccept(invitation);
                  }}
                  size="sm"
                >
                  {isPending ? (
                    <Spinner className="size-4" />
                  ) : (
                    <>
                      <Check className="size-4" />
                      Accept
                    </>
                  )}
                </Button>
              </div>
            </m.li>
          ))}
        </AnimatePresence>
      </ul>
    </SectionCard>
  );
};

export { InvitationsList };
