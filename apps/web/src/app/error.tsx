"use client";

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
    <div className="px-6 flex min-h-screen flex-col items-center justify-center">
      <main className="max-w-md gap-6 flex w-full flex-col items-center text-center">
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center bg-destructive/10">
          <AlertCircle className="h-7 w-7 text-destructive" />
        </div>

        <div className="gap-2 flex flex-col">
          <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
          <p className="text-muted-foreground">An unexpected error occurred. Please try again.</p>
        </div>

        <button
          onClick={reset}
          className="h-11 gap-2 px-6 font-medium flex items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <RefreshCw className="h-4.5 w-4.5" />
          Try Again
        </button>
      </main>
    </div>
  );
};

export default Error;
