"use client";

import { Button } from "@repo/ui/components/button";
import { captureException } from "@sentry/nextjs";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const RouteError = ({ error, reset }: RouteErrorProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    captureException(error);
    headingRef.current?.focus();
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      {/* The boundary sits above the segment layouts, so it renders in place of the only
          <main id="main"> the root layout's skip link can target. */}
      <main className="flex w-full max-w-md flex-col items-center gap-6 text-center" id="main">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="size-5 text-destructive" />
        </div>

        <div className="flex flex-col gap-2">
          <h1
            className="max-w-[24ch] text-2xl font-semibold tracking-tight text-balance"
            ref={headingRef}
            tabIndex={-1}
          >
            Something went wrong
          </h1>
          <p className="max-w-[48ch] text-sm text-pretty text-muted-foreground">
            An unexpected error occurred. Please try again. If it keeps happening, refresh the page
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

export default RouteError;
