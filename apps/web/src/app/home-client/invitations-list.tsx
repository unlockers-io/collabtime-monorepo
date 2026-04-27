"use client";

import { Button } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui/components/spinner";
import { Check, Mail, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import type { PendingInvitation } from "@/types";

type InvitationsListProps = {
  invitations: Array<PendingInvitation>;
  onAccept: (invitation: PendingInvitation) => void;
  onDecline: (invitation: PendingInvitation) => void;
  processingInvitations: Set<string>;
};

const InvitationsList = ({
  invitations,
  onAccept,
  onDecline,
  processingInvitations,
}: InvitationsListProps) => (
  <AnimatePresence>
    {invitations.length > 0 && (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex w-full flex-col gap-3"
        exit={{ opacity: 0, y: -10 }}
        initial={{ opacity: 0, y: 20 }}
        transition={{
          delay: 0.2,
          duration: 0.6,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground">Pending Invitations</h2>
        </div>

        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {invitations.map((invitation) => {
              const isProcessing = processingInvitations.has(invitation.id);
              return (
                <motion.div
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3"
                  exit={{ opacity: 0, scale: 0.95 }}
                  initial={{ opacity: 0, scale: 0.95 }}
                  key={invitation.id}
                  layout
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
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
                      disabled={isProcessing}
                      onClick={() => onDecline(invitation)}
                      size="sm"
                      variant="ghost"
                    >
                      {isProcessing ? <Spinner className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </Button>
                    <Button
                      aria-label={`Accept invitation to ${invitation.teamName}`}
                      disabled={isProcessing}
                      onClick={() => onAccept(invitation)}
                      size="sm"
                    >
                      {isProcessing ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Accept
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export { InvitationsList };
