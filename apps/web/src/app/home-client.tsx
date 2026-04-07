"use client";

import { Button, buttonVariants, cn, Spinner } from "@repo/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Mail, Shield, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Nav } from "@/components/nav";
import { acceptInvitation, declineInvitation } from "@/lib/actions/invitation-actions";
import { createTeam } from "@/lib/actions/team-create";
import { getUserTimezone } from "@/lib/timezones";
import type { PendingInvitation } from "@/types";

type MyTeam = {
  memberCount: number;
  role: string;
  teamId: string;
  teamName: string;
};

type HomeClientProps = {
  isAuthenticated: boolean;
};

const HomeClient = ({ isAuthenticated }: HomeClientProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [processingInvitations, setProcessingInvitations] = useState<Set<string>>(new Set());

  const { data: invitations = [] } = useQuery<Array<PendingInvitation>>({
    queryKey: ["my-invitations"],
    queryFn: async () => {
      const response = await fetch("/api/invitations");
      if (!response.ok) {
        throw new Error("Failed to fetch invitations");
      }
      const data = (await response.json()) as { invitations: Array<PendingInvitation> };
      return data.invitations;
    },
    enabled: isAuthenticated,
  });

  const handleAcceptInvitation = async (invitation: PendingInvitation) => {
    setProcessingInvitations((prev) => new Set(prev).add(invitation.id));
    try {
      const result = await acceptInvitation(invitation.id);
      if (result.success) {
        toast.success(`Joined ${invitation.teamName}`);
        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: ["my-invitations"] }),
          queryClient.invalidateQueries({ queryKey: ["my-teams"] }),
        ]);
      } else {
        toast.error(result.error);
      }
    } finally {
      setProcessingInvitations((prev) => {
        const next = new Set(prev);
        next.delete(invitation.id);
        return next;
      });
    }
  };

  const handleDeclineInvitation = async (invitation: PendingInvitation) => {
    setProcessingInvitations((prev) => new Set(prev).add(invitation.id));
    try {
      const result = await declineInvitation(invitation.id);
      if (result.success) {
        toast.success("Invitation declined");
        await queryClient.invalidateQueries({ queryKey: ["my-invitations"] });
      } else {
        toast.error(result.error);
      }
    } finally {
      setProcessingInvitations((prev) => {
        const next = new Set(prev);
        next.delete(invitation.id);
        return next;
      });
    }
  };

  const { data: myTeams = [], isLoading: isLoadingTeams } = useQuery({
    queryKey: ["my-teams"],
    queryFn: async () => {
      const response = await fetch("/api/teams");
      if (!response.ok) {
        throw new Error("Failed to fetch teams");
      }
      const data = (await response.json()) as { teams: Array<MyTeam> };
      return data.teams;
    },
    enabled: isAuthenticated,
  });

  const handleCreateTeam = async () => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    setIsCreating(true);
    try {
      const result = await createTeam(getUserTimezone());
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
      <Nav isAuthenticated={isAuthenticated} />

      <main className="max-w-lg gap-10 px-4 py-8 sm:gap-12 sm:px-6 mx-auto flex w-full flex-1 flex-col items-center justify-center">
        <div className="gap-6 flex flex-col items-center text-center">
          <div className="gap-2 sm:gap-3 flex flex-col">
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Collab Time</h1>
            <p className="max-w-sm text-base leading-relaxed sm:text-lg text-muted-foreground">
              Visualize your team&apos;s working hours across timezones. Find the perfect moment to
              connect.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="gap-4 flex w-full flex-col items-center">
          {isAuthenticated ? (
            <button
              onClick={handleCreateTeam}
              disabled={isCreating}
              className="group h-12 gap-2 px-6 text-base font-semibold sm:h-14 sm:w-auto sm:min-w-72 sm:gap-3 sm:px-8 sm:text-lg flex w-full items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? (
                <>
                  <Spinner className="h-5 w-5 text-primary-foreground" />
                  Creating workspace...
                </>
              ) : (
                <>
                  Create Team Workspace
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                </>
              )}
            </button>
          ) : (
            <div className="gap-3 flex w-full flex-col items-center">
              <Link
                href="/signup"
                className={cn(buttonVariants({ size: "lg" }), "sm:w-auto sm:min-w-72 w-full")}
              >
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-foreground hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Pending Invitations */}
        <AnimatePresence>
          {isAuthenticated && invitations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{
                duration: 0.6,
                delay: 0.2,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="gap-3 flex w-full flex-col"
            >
              <div className="gap-2 flex items-center">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium text-muted-foreground">Pending Invitations</h2>
              </div>

              <div className="gap-2 flex flex-col">
                <AnimatePresence mode="popLayout">
                  {invitations.map((invitation) => {
                    const isProcessing = processingInvitations.has(invitation.id);
                    return (
                      <motion.div
                        key={invitation.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="p-3 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5"
                      >
                        <div className="gap-3 flex items-center">
                          <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary/10">
                            <Mail className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">
                              {invitation.teamName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Invited by {invitation.inviterName}
                            </span>
                          </div>
                        </div>
                        <div className="gap-1 flex items-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => handleDeclineInvitation(invitation)}
                            aria-label={`Decline invitation to ${invitation.teamName}`}
                          >
                            {isProcessing ? (
                              <Spinner className="h-4 w-4" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => handleAcceptInvitation(invitation)}
                            aria-label={`Accept invitation to ${invitation.teamName}`}
                          >
                            {isProcessing ? (
                              <Spinner className="h-4 w-4" />
                            ) : (
                              <>
                                <Check className="h-4 w-4" />
                                Accept
                              </>
                            )}
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
              className="gap-3 flex w-full flex-col"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">My Teams</h2>
              </div>

              <div className="gap-2 flex flex-col">
                <AnimatePresence mode="popLayout">
                  {myTeams.map((team) => (
                    <motion.div
                      key={team.teamId}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="group p-3 flex items-center justify-between rounded-xl border border-border bg-card transition-colors hover:border-input"
                    >
                      <Link href={`/${team.teamId}`} className="gap-3 flex flex-1 items-center">
                        <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-secondary">
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
                      {team.role === "ADMIN" && (
                        <Shield className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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

export { HomeClient };
