"use client";

import { Button, buttonVariants } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui/components/spinner";
import { cn } from "@repo/ui/lib/utils";
import { LogIn, UserPlus } from "lucide-react";
import Link from "next/link";

import type { TeamStatus } from "@/types";

type JoinPromptProps = {
  isAuthenticated: boolean;
  isRequestingJoin: boolean;
  onRequestJoin: () => void;
  teamId: string;
  teamStatus: TeamStatus;
};

const JoinPrompt = ({
  isAuthenticated,
  isRequestingJoin,
  onRequestJoin,
  teamId,
  teamStatus,
}: JoinPromptProps) => {
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/50 px-4 py-3">
        <p className="text-sm text-muted-foreground">Sign in to request access</p>
        <Link
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          href={`/login?redirect=/${teamId}`}
        >
          <LogIn className="mr-2 h-4 w-4" />
          Sign in
        </Link>
      </div>
    );
  }

  if (teamStatus === "PENDING") {
    return (
      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/50 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Your join request is pending admin approval.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-muted/50 px-4 py-3">
      <p className="text-sm text-muted-foreground">Request access to edit this team</p>
      <Button disabled={isRequestingJoin} onClick={onRequestJoin} size="sm" variant="outline">
        {isRequestingJoin ? (
          <Spinner className="mr-2 h-4 w-4" />
        ) : (
          <UserPlus className="mr-2 h-4 w-4" />
        )}
        Request to Join
      </Button>
    </div>
  );
};

export { JoinPrompt };
