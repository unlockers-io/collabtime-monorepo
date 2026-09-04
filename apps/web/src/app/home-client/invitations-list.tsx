"use client";

import { Button } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui/components/spinner";
import { Check, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";

import type { PendingInvitation } from "@/types";

type InvitationsListProps = {
  invitations: Array<PendingInvitation>;
  isPending: boolean;
  onAccept: (invitation: PendingInvitation) => void;
  onDecline: (invitation: PendingInvitation) => void;
};

const InvitationsList = ({ invitations, isPending, onAccept, onDecline }: InvitationsListProps) => (
  <AnimatePresence>
    {invitations.length > 0 && (
      <m.div
        animate={{ opacity: 1 }}
        className="flex w-full flex-col"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        transition={{
          delay: 0.2,
          duration: 0.15,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <div className="border-b border-border pb-3">
          <h2 className="font-display text-sm font-semibold tracking-[0.08em] text-foreground uppercase">
            Pending invitations
          </h2>
        </div>

        <div className="flex flex-col">
          <AnimatePresence mode="popLayout">
            {invitations.map((invitation) => {
              return (
                <m.div
                  animate={{ opacity: 1 }}
                  className="flex min-h-24 items-center justify-between gap-4 border-b border-border py-5"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  key={invitation.id}
                  layout
                  transition={{ duration: 0.12 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">
                        {invitation.teamName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Invited by {invitation.inviterName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
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
                </m.div>
              );
            })}
          </AnimatePresence>
        </div>
      </m.div>
    )}
  </AnimatePresence>
);

export { InvitationsList };
