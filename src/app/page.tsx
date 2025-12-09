"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createTeam } from "@/lib/actions";

const Home = () => {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateTeam = async () => {
    setIsCreating(true);

    try {
      const result = await createTeam();
      if (result.success) {
        router.push(`/${result.data}`);
      } else {
        toast.error(result.error);
        setIsCreating(false);
      }
    } catch {
      toast.error("Failed to create team. Please try again.");
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-12 px-8 py-16 bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-black dark:text-neutral-50 sm:text-5xl">
            Collab Time
          </h1>
          <p className="max-w-md text-lg leading-8 text-neutral-600 dark:text-neutral-400">
            Visualize your team&apos;s working hours across timezones. Find the
            best time to collaborate.
          </p>
        </div>

        <button
          onClick={handleCreateTeam}
          disabled={isCreating}
          className="flex h-14 items-center justify-center gap-2 rounded-full bg-neutral-900 px-8 text-lg font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {isCreating ? (
            <>
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-neutral-900" />
              Creating...
            </>
          ) : (
            "Create a Team"
          )}
        </button>

        <div className="flex flex-col items-center gap-2 text-sm text-neutral-500 dark:text-neutral-500">
          <p>No account required. Share the link with your team.</p>
        </div>
      </main>
    </div>
  );
};

export default Home;
