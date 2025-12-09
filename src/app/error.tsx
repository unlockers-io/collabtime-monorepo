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
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/30">
          <AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Something went wrong
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            An unexpected error occurred. Please try again.
          </p>
        </div>

        <button
          onClick={reset}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-6 font-medium text-white transition-all hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 dark:focus-visible:ring-neutral-100 dark:focus-visible:ring-offset-neutral-950"
        >
          <RefreshCw className="h-4.5 w-4.5" />
          Try Again
        </button>
      </main>
    </div>
  );
};

export default Error;
