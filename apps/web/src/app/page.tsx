"use client";

import { Button, Spinner } from "@repo/ui";
import { ArrowRight, Shield, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Nav } from "@/components/nav";
import { createTeam } from "@/lib/actions";
import { useSession } from "@/lib/auth-client";

type MyTeam = {
  memberCount: number;
  role: string;
  teamId: string;
  teamName: string;
};

const Home = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const [isCreating, setIsCreating] = useState(false);
  const [myTeams, setMyTeams] = useState<Array<MyTeam>>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);

  const isAuthenticated = Boolean(session?.user);

  // Fetch user's teams from DB
  useEffect(() => {
    if (!isAuthenticated) {
      setMyTeams([]);
      return;
    }

    const fetchTeams = async () => {
      setIsLoadingTeams(true);
      try {
        const response = await fetch("/api/teams");
        if (response.ok) {
          const data = (await response.json()) as { teams: Array<MyTeam> };
          setMyTeams(data.teams);
        }
      } catch {
        // Silently fail — teams list is non-critical
      } finally {
        setIsLoadingTeams(false);
      }
    };

    fetchTeams();
  }, [isAuthenticated]);

  const handleCreateTeam = async () => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    setIsCreating(true);
    try {
      const result = await createTeam();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      router.push(`/${result.data}`);
    } catch {
      toast.error("Failed to create team. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <Nav />

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-10 px-4 py-8 sm:gap-12 sm:px-6">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex flex-col gap-2 sm:gap-3">
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Collab Time</h1>
            <p className="max-w-sm text-base leading-relaxed text-muted-foreground sm:text-lg">
              Visualize your team&apos;s working hours across timezones. Find the perfect moment to
              connect.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="flex w-full flex-col items-center gap-4">
          {isAuthenticated ? (
            <button
              onClick={handleCreateTeam}
              disabled={isCreating}
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:h-14 sm:w-auto sm:min-w-72 sm:gap-3 sm:px-8 sm:text-lg"
            >
              {isCreating ? (
                <>
                  <Spinner className="h-5 w-5 text-primary-foreground" />
                  Creating workspace...
                </>
              ) : (
                <>
                  Create Team Workspace
                  <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                </>
              )}
            </button>
          ) : (
            <div className="flex w-full flex-col items-center gap-3">
              <Button asChild size="lg" className="w-full sm:w-auto sm:min-w-72">
                <Link href="/signup">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-foreground hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* My Teams */}
        <AnimatePresence>
          {isAuthenticated && !isLoadingTeams && myTeams.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{
                duration: 0.6,
                delay: 0.3,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="flex w-full flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">My Teams</h2>
              </div>

              <div className="flex flex-col gap-2">
                <AnimatePresence mode="popLayout">
                  {myTeams.map((team) => (
                    <motion.div
                      key={team.teamId}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="group flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-colors hover:border-input"
                    >
                      <Link href={`/${team.teamId}`} className="flex flex-1 items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {team.teamName || "Team Workspace"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {team.memberCount === 0
                              ? "Empty"
                              : `${team.memberCount} member${team.memberCount !== 1 ? "s" : ""}`}
                          </span>
                        </div>
                      </Link>
                      {team.role === "admin" && (
                        <Shield className="h-4 w-4 text-muted-foreground" />
                      )}
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
