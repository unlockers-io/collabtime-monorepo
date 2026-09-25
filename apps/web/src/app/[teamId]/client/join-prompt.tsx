"use client";

import { Button, buttonVariants } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui/components/spinner";
import { cn } from "@repo/ui/lib/utils";
import { LogIn, UserPlus } from "lucide-react";
import Link from "next/link";

import { AcceptWorkspaceInvitation } from "@/components/accept-workspace-invitation";
import type { TeamStatus } from "@/types";

import { InviteMismatchNotice } from "./invite-mismatch-notice";

export type JoinPromptProps = {
  invitationId?: string;
  inviteMismatch?: { invitedEmailMasked: string };
  inviterName?: string;
  isAuthenticated: boolean;
  isRequestingJoin: boolean;
  onRequestJoin: () => void;
  returnTo: string;
  teamId: string;
  teamName?: string;
  teamStatus: TeamStatus;
};

const JoinPrompt = ({
  invitationId,
  inviteMismatch,
  inviterName,
  isAuthenticated,
  isRequestingJoin,
  onRequestJoin,
  returnTo,
  teamName,
  teamStatus,
}: JoinPromptProps) => {
  if (!isAuthenticated) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-pretty text-muted-foreground">
          Work on this team? Create an account to add your own hours.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            className={cn(buttonVariants({ size: "sm" }))}
            href={`/register?redirect=${encodeURIComponent(returnTo)}`}
          >
            Create account
          </Link>
          <Link
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
            href={`/login?redirect=${encodeURIComponent(returnTo)}`}
          >
            <LogIn className="mr-2 size-4" />
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (teamStatus === "INVITED" && invitationId !== undefined) {
    return (
      <div>
        <AcceptWorkspaceInvitation
          invitationId={invitationId}
          inviterName={inviterName}
          teamName={teamName}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {inviteMismatch && <InviteMismatchNotice {...inviteMismatch} returnTo={returnTo} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {teamStatus === "PENDING"
            ? "Your join request is pending admin approval."
            : "Work on this team? Ask an admin to let you in."}
        </p>
        {teamStatus !== "PENDING" && (
          <Button disabled={isRequestingJoin} onClick={onRequestJoin} size="sm" variant="outline">
            {isRequestingJoin ? (
              <Spinner className="mr-2 size-4" />
            ) : (
              <UserPlus className="mr-2 size-4" />
            )}
            Request to join
          </Button>
        )}
      </div>
    </div>
  );
};
export { JoinPrompt };
