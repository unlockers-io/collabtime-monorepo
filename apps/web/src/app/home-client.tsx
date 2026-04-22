"use client";

import { Button, buttonVariants } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Spinner } from "@repo/ui/components/spinner";
import { cn } from "@repo/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Check,
  ChevronDown,
  Mail,
  MoreHorizontal,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { DeleteWorkspaceDialog } from "@/components/delete-workspace-dialog";
import { Nav } from "@/components/nav";
import { acceptInvitation, declineInvitation } from "@/lib/actions/invitation-actions";
import { createTeam } from "@/lib/actions/team-create";
import { getUserTimezone } from "@/lib/timezones";
import type { PendingInvitation } from "@/types";

type MyTeam = {
  archivedAt: string | null;
  memberCount: number;
  role: string;
  spaceId: string | null;
  teamId: string;
  teamName: string;
};

type WorkspaceToDelete = {
  spaceId: string;
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
  const [processingArchive, setProcessingArchive] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<WorkspaceToDelete | null>(null);

  const handleWorkspaceDeleted = async () => {
    await queryClient.invalidateQueries({ queryKey: ["my-teams"] });
  };

  const { data: invitations = [] } = useQuery<Array<PendingInvitation>>({
    enabled: isAuthenticated,
    queryFn: async () => {
      const response = await fetch("/api/invitations");
      if (!response.ok) {
        throw new Error("Failed to fetch invitations");
      }
      const data = (await response.json()) as { invitations: Array<PendingInvitation> };
      return data.invitations;
    },
    queryKey: ["my-invitations"],
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
    enabled: isAuthenticated,
    queryFn: async () => {
      const response = await fetch("/api/teams");
      if (!response.ok) {
        throw new Error("Failed to fetch teams");
      }
      const data = (await response.json()) as { teams: Array<MyTeam> };
      return data.teams;
    },
    queryKey: ["my-teams"],
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

  const handleToggleArchive = async (team: MyTeam, archive: boolean) => {
    setProcessingArchive((prev) => new Set(prev).add(team.teamId));
    try {
      const response = await fetch(`/api/teams/${team.teamId}/membership`, {
        body: JSON.stringify({ archived: archive }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "Failed to update workspace");
        return;
      }

      toast.success(archive ? "Workspace archived" : "Workspace restored");
      await queryClient.invalidateQueries({ queryKey: ["my-teams"] });
    } catch {
      toast.error("Failed to update workspace");
    } finally {
      setProcessingArchive((prev) => {
        const next = new Set(prev);
        next.delete(team.teamId);
        return next;
      });
    }
  };

  const activeTeams = myTeams.filter((team) => team.archivedAt === null);
  const archivedTeams = myTeams.filter((team) => team.archivedAt !== null);

  return (
    <div className="flex flex-1 flex-col">
      <Nav isAuthenticated={isAuthenticated} />

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-10 px-4 py-8 sm:gap-12 sm:px-6">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex flex-col gap-2 sm:gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              Collab Time
            </h1>
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
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:h-14 sm:w-auto sm:min-w-72 sm:gap-3 sm:px-8 sm:text-lg"
              disabled={isCreating}
              onClick={handleCreateTeam}
              type="button"
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
              <Link
                className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto sm:min-w-72")}
                href="/signup"
              >
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link className="font-medium text-foreground hover:underline" href="/login">
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
              animate={{ opacity: 1, y: 0 }}
              className="flex w-full flex-col gap-3"
              exit={{ opacity: 0, y: -10 }}
              initial={{ opacity: 0, y: 20 }}
              transition={{
                delay: 0.2,
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium text-muted-foreground">Pending Invitations</h2>
              </div>

              <div className="flex flex-col gap-2">
                <AnimatePresence mode="popLayout">
                  {invitations.map((invitation) => {
                    const isProcessing = processingInvitations.has(invitation.id);
                    return (
                      <motion.div
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3"
                        exit={{ opacity: 0, scale: 0.95 }}
                        initial={{ opacity: 0, scale: 0.95 }}
                        key={invitation.id}
                        layout
                        transition={{ duration: 0.2 }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
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
                        <div className="flex items-center gap-1">
                          <Button
                            aria-label={`Decline invitation to ${invitation.teamName}`}
                            disabled={isProcessing}
                            onClick={() => handleDeclineInvitation(invitation)}
                            size="sm"
                            variant="ghost"
                          >
                            {isProcessing ? (
                              <Spinner className="h-4 w-4" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            aria-label={`Accept invitation to ${invitation.teamName}`}
                            disabled={isProcessing}
                            onClick={() => handleAcceptInvitation(invitation)}
                            size="sm"
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
          {isAuthenticated && !isLoadingTeams && activeTeams.length > 0 && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="flex w-full flex-col gap-3"
              exit={{ opacity: 0, y: -10 }}
              initial={{ opacity: 0, y: 20 }}
              transition={{
                delay: 0.3,
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">My Teams</h2>
              </div>

              <div className="flex flex-col gap-2">
                <AnimatePresence mode="popLayout">
                  {activeTeams.map((team) => {
                    const isArchivePending = processingArchive.has(team.teamId);
                    return (
                      <motion.div
                        animate={{ opacity: 1, scale: 1 }}
                        className="group flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-colors hover:border-input"
                        exit={{ opacity: 0, scale: 0.95 }}
                        initial={{ opacity: 0, scale: 0.95 }}
                        key={team.teamId}
                        layout
                        transition={{ duration: 0.2 }}
                      >
                        <Link className="flex flex-1 items-center gap-3" href={`/${team.teamId}`}>
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
                        <div className="flex items-center gap-1 pl-2">
                          {team.role === "ADMIN" && (
                            <Shield aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  aria-label={`More actions for ${team.teamName || "this workspace"}`}
                                  size="icon-sm"
                                  variant="ghost"
                                />
                              }
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={4}>
                              <DropdownMenuItem
                                disabled={isArchivePending}
                                onClick={() => handleToggleArchive(team, true)}
                              >
                                <Archive />
                                Archive
                              </DropdownMenuItem>
                              {team.spaceId && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (!team.spaceId) {
                                      return;
                                    }
                                    setWorkspaceToDelete({
                                      spaceId: team.spaceId,
                                      teamName: team.teamName,
                                    });
                                  }}
                                  variant="destructive"
                                >
                                  <Trash2 />
                                  Delete workspace
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Archived Teams */}
        <AnimatePresence>
          {isAuthenticated && !isLoadingTeams && archivedTeams.length > 0 && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="flex w-full flex-col gap-3"
              exit={{ opacity: 0, y: -10 }}
              initial={{ opacity: 0, y: 20 }}
              transition={{
                delay: 0.4,
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <button
                aria-expanded={showArchived}
                className="flex items-center justify-between rounded-md text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                onClick={() => setShowArchived((prev) => !prev)}
                type="button"
              >
                <span>
                  {archivedTeams.length} archived &mdash; {showArchived ? "Hide" : "Show"}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "h-4 w-4 transition-transform",
                    showArchived ? "rotate-180" : "rotate-0",
                  )}
                />
              </button>

              <AnimatePresence initial={false}>
                {showArchived && (
                  <motion.div
                    animate={{ height: "auto", opacity: 1 }}
                    className="flex flex-col gap-2 overflow-hidden"
                    exit={{ height: 0, opacity: 0 }}
                    initial={{ height: 0, opacity: 0 }}
                    key="archived-list"
                    transition={{ duration: 0.2 }}
                  >
                    <AnimatePresence mode="popLayout">
                      {archivedTeams.map((team) => {
                        const isArchivePending = processingArchive.has(team.teamId);
                        return (
                          <motion.div
                            animate={{ opacity: 1, scale: 1 }}
                            className="group flex items-center justify-between rounded-xl border border-border bg-card/60 p-3 transition-colors hover:border-input"
                            exit={{ opacity: 0, scale: 0.95 }}
                            initial={{ opacity: 0, scale: 0.95 }}
                            key={team.teamId}
                            layout
                            transition={{ duration: 0.2 }}
                          >
                            <Link
                              className="flex flex-1 items-center gap-3"
                              href={`/${team.teamId}`}
                            >
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                                <Archive className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-muted-foreground">
                                  {team.teamName || "Team Workspace"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {team.memberCount === 0
                                    ? "Empty"
                                    : `${team.memberCount} member${team.memberCount !== 1 ? "s" : ""}`}
                                </span>
                              </div>
                            </Link>
                            <div className="flex items-center gap-1 pl-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button
                                      aria-label={`More actions for ${team.teamName || "this workspace"}`}
                                      size="icon-sm"
                                      variant="ghost"
                                    />
                                  }
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" sideOffset={4}>
                                  <DropdownMenuItem
                                    disabled={isArchivePending}
                                    onClick={() => handleToggleArchive(team, false)}
                                  >
                                    <ArchiveRestore />
                                    Unarchive
                                  </DropdownMenuItem>
                                  {team.spaceId && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        if (!team.spaceId) {
                                          return;
                                        }
                                        setWorkspaceToDelete({
                                          spaceId: team.spaceId,
                                          teamName: team.teamName,
                                        });
                                      }}
                                      variant="destructive"
                                    >
                                      <Trash2 />
                                      Delete workspace
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {workspaceToDelete && (
        <DeleteWorkspaceDialog
          onDeleted={handleWorkspaceDeleted}
          onOpenChange={(open) => {
            if (!open) {
              setWorkspaceToDelete(null);
            }
          }}
          open={workspaceToDelete !== null}
          spaceId={workspaceToDelete.spaceId}
          teamName={workspaceToDelete.teamName}
        />
      )}
    </div>
  );
};

export { HomeClient };
