"use client";

import { Button } from "@repo/ui/components/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useEffect } from "react";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const Error = ({ error, reset }: ErrorProps) => {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <main className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="size-5 text-destructive" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="max-w-[24ch] text-2xl font-semibold tracking-tight text-balance">
            Something went wrong
          </h1>
          <p className="max-w-[48ch] text-sm text-pretty text-muted-foreground">
            An unexpected error occurred. Please try again — if it keeps happening, refresh the page
            or come back in a few minutes.
          </p>
        </div>

        <Button onClick={reset}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
      </main>
    </div>
  );
};

export default Error;
