"use client";

import { Button, buttonVariants } from "@repo/ui/components/button";
import { CircleAlert } from "lucide-react";
import Link from "next/link";

type TeamUnavailableProps = {
  isRetrying?: boolean;
  message: string;
  onRetry: () => void;
};

const TeamUnavailable = ({ isRetrying = false, message, onRetry }: TeamUnavailableProps) => (
  <main
    className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-20"
    id="main"
  >
    <CircleAlert aria-hidden className="size-8 text-muted-foreground" />
    <div>
      <h1 className="font-display text-2xl font-semibold">Couldn&apos;t load this workspace</h1>
      <p className="mt-3 text-muted-foreground" role="alert">
        {message}
      </p>
    </div>
    <div className="flex flex-wrap gap-3">
      <Button disabled={isRetrying} onClick={onRetry}>
        {isRetrying ? "Trying again…" : "Try again"}
      </Button>
      <Link className={buttonVariants({ variant: "outline" })} href="/">
        Back to workspaces
      </Link>
    </div>
  </main>
);

export { TeamUnavailable };
