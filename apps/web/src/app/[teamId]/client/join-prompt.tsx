"use client";

import { Button, buttonVariants } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui/components/spinner";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { cn } from "@repo/ui/lib/utils";
import { LogIn, UserPlus } from "lucide-react";
import Link from "next/link";

import { AcceptWorkspaceInvitation } from "@/components/accept-workspace-invitation";
import { withRedirect } from "@/lib/redirect-validation";

import type { TeamPageViewer } from "../viewer";

import { InviteMismatchNotice } from "./invite-mismatch-notice";

type JoinPromptProps = {
  isRequestingJoin: boolean;
  onRequestJoin: () => void;
  returnTo: string;
  teamName: string;
  viewer: TeamPageViewer;
};

const JoinPrompt = ({
  isRequestingJoin,
  onRequestJoin,
  returnTo,
  teamName,
  viewer: { invitation, inviteMismatch, status, userId },
}: JoinPromptProps) => {
  const ready = useClientReady();

  if (userId === null) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-pretty text-muted-foreground">
          Work on this team? Create an account to add your own hours.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            className={cn(buttonVariants({ size: "sm" }))}
            href={withRedirect("/register", returnTo)}
          >
            Create account
          </Link>
          <Link
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
            href={withRedirect("/login", returnTo)}
          >
            <LogIn className="mr-2 size-4" />
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (status === "INVITED" && invitation !== undefined) {
    return (
      <div>
        <AcceptWorkspaceInvitation
          invitationId={invitation.id}
          inviterName={invitation.inviterName}
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
          {status === "PENDING"
            ? "Your join request is pending admin approval."
            : "Work on this team? Ask an admin to let you in."}
        </p>
        {status !== "PENDING" && (
          <Button
            disabled={!ready || isRequestingJoin}
            onClick={onRequestJoin}
            size="sm"
            variant="outline"
          >
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
