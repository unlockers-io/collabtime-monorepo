"use client";

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
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-6 px-8 py-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Something went wrong
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            An unexpected error occurred. Please try again.
          </p>
        </div>
        <button
          onClick={reset}
          className="flex h-10 items-center justify-center rounded-md bg-neutral-900 px-6 font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          Try Again
        </button>
      </main>
    </div>
  );
};

export default Error;
