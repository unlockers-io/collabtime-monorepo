"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Globe, Users, X } from "lucide-react";
import { useVisitedTeams } from "@/hooks/use-visited-teams";
import { createTeam } from "@/lib/actions";
import { Spinner } from "@/components/ui/spinner";

const Home = () => {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const { visitedTeams, removeVisitedTeam, isHydrated } = useVisitedTeams();

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

  const handleRemoveTeam = (teamId: string) => {
    removeVisitedTeam(teamId);
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
      <main className="flex w-full max-w-lg flex-col items-center gap-10 sm:gap-12">
        {/* Logo and title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-6 text-center"
        >
          {/* Globe icon */}
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-900 dark:bg-neutral-100 sm:h-20 sm:w-20">
            <Globe className="h-8 w-8 text-white dark:text-neutral-900 sm:h-10 sm:w-10" />
          </div>

          <div className="flex flex-col gap-2 sm:gap-3">
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Collab Time
            </h1>
            <p className="max-w-sm text-base leading-relaxed text-neutral-600 dark:text-neutral-400 sm:text-lg">
              Visualize your team&apos;s working hours across timezones. Find
              the perfect moment to connect.
            </p>
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="flex w-full flex-col items-center gap-4"
        >
          <button
            onClick={handleCreateTeam}
            disabled={isCreating}
            className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-6 text-base font-semibold text-white transition-all hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 dark:focus-visible:ring-neutral-100 dark:focus-visible:ring-offset-neutral-950 sm:h-14 sm:w-auto sm:min-w-72 sm:gap-3 sm:px-8 sm:text-lg"
          >
            {isCreating ? (
              <>
                <Spinner className="h-5 w-5 text-white dark:text-neutral-900" />
                Creating workspace...
              </>
            ) : (
              <>
                Create Team Workspace
                <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
              </>
            )}
          </button>

          <p className="text-sm text-neutral-500">
            No account needed &middot; Share the link with your team
          </p>
        </motion.div>

        {/* Visited Teams */}
        <AnimatePresence>
          {isHydrated && visitedTeams.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex w-full flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  Recent Workspaces
                </h2>
              </div>

              <div className="flex flex-col gap-2">
                <AnimatePresence mode="popLayout">
                  {visitedTeams.map((team) => (
                    <motion.div
                      key={team.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="group flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-3 transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
                    >
                      <Link
                        href={`/${team.id}`}
                        className="flex flex-1 items-center gap-3"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
                          <Users className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {team.name || "Team Workspace"}
                          </span>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            {team.memberCount === 0
                              ? "Empty"
                              : `${team.memberCount} member${team.memberCount !== 1 ? "s" : ""}`}
                            {" · "}
                            {formatRelativeTime(team.lastVisited)}
                          </span>
                        </div>
                      </Link>
                      <button
                        onClick={() => handleRemoveTeam(team.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 opacity-0 transition-all hover:bg-neutral-100 hover:text-neutral-600 group-hover:opacity-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                        aria-label="Remove from list"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Home;
