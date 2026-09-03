"use client";

import { toast } from "@repo/ui/components/sonner";
import { Spinner } from "@repo/ui/components/spinner";
import { captureException } from "@sentry/nextjs";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Nav } from "@/components/nav";
import { createTeam } from "@/lib/actions/team-create";
import { getUserTimezone } from "@/lib/timezones";

type HomeShellProps = {
  children: React.ReactNode;
};

const HomeShell = ({ children }: HomeShellProps) => {
  const { push } = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateTeam = async () => {
    setIsCreating(true);
    try {
      const result = await createTeam(getUserTimezone());
      if (result.success) {
        push(`/${result.data}`);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      captureException(error);
      toast.error("Failed to create team. Please try again.");
    }
    setIsCreating(false);
  };

  return (
    <div className="flex flex-1 flex-col">
      <Nav isAuthenticated />

      <main
        className="mx-auto flex w-full max-w-450 flex-1 flex-col gap-14 px-4 py-14 sm:px-6 sm:py-20 lg:px-8 xl:px-12"
        id="main"
      >
        <div className="grid items-end gap-8 border-b border-border pb-10 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-5xl font-semibold tracking-[-0.04em] text-balance sm:text-7xl">
              Your workspaces
            </h1>
            <p className="max-w-lg text-base text-pretty text-muted-foreground sm:text-lg">
              Open a team to read the shared day, or create a new workspace.
            </p>
          </div>
          <button
            className="group flex h-12 w-full items-center justify-center gap-2 bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            disabled={isCreating}
            onClick={() => {
              void handleCreateTeam();
            }}
            type="button"
          >
            {isCreating ? (
              <>
                <Spinner className="size-5 shrink-0 text-primary-foreground" />
                Creating workspace…
              </>
            ) : (
              <>
                Create a workspace
                <ArrowRight className="size-5 shrink-0" />
              </>
            )}
          </button>
        </div>
        {children}
      </main>
    </div>
  );
};

export { HomeShell };
