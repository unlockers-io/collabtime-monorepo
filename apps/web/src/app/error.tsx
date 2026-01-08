"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const Error = ({ error, reset }: ErrorProps) => {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <main className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertCircle className="h-7 w-7 text-destructive" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground">
            Something went wrong
          </h1>
          <p className="text-muted-foreground">
            An unexpected error occurred. Please try again.
          </p>
        </div>

        <button
          onClick={reset}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-medium text-primary-foreground transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <RefreshCw className="h-4.5 w-4.5" />
          Try Again
        </button>
      </main>
    </div>
  );
};

export default Error;
