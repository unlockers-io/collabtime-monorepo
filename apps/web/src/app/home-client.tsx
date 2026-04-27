"use client";

import { buttonVariants } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui/components/spinner";
import { cn } from "@repo/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { DeleteWorkspaceDialog } from "@/components/delete-workspace-dialog";
import { Nav } from "@/components/nav";
import { createTeam } from "@/lib/actions/team-create";
import { getUserTimezone } from "@/lib/timezones";

import { ArchivedTeamsList } from "./home-client/archived-teams-list";
import { InvitationsList } from "./home-client/invitations-list";
import { TeamsList } from "./home-client/teams-list";
import type { WorkspaceToDelete } from "./home-client/types";
import { useInvitations } from "./home-client/use-invitations";
import { useMyTeams } from "./home-client/use-my-teams";

type HomeClientProps = {
  isAuthenticated: boolean;
};

const HomeClient = ({ isAuthenticated }: HomeClientProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<WorkspaceToDelete | null>(null);

  const { handleAcceptInvitation, handleDeclineInvitation, invitations, processingInvitations } =
    useInvitations(isAuthenticated);
  const { handleToggleArchive, isLoadingTeams, myTeams, processingArchive } =
    useMyTeams(isAuthenticated);

  const handleWorkspaceDeleted = async () => {
    await queryClient.invalidateQueries({ queryKey: ["my-teams"] });
  };

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

        {isAuthenticated && (
          <InvitationsList
            invitations={invitations}
            onAccept={handleAcceptInvitation}
            onDecline={handleDeclineInvitation}
            processingInvitations={processingInvitations}
          />
        )}

        {isAuthenticated && !isLoadingTeams && (
          <TeamsList
            onArchive={(team) => handleToggleArchive(team, true)}
            onRequestDelete={setWorkspaceToDelete}
            processingArchive={processingArchive}
            teams={activeTeams}
          />
        )}

        {isAuthenticated && !isLoadingTeams && (
          <ArchivedTeamsList
            onRequestDelete={setWorkspaceToDelete}
            onUnarchive={(team) => handleToggleArchive(team, false)}
            processingArchive={processingArchive}
            teams={archivedTeams}
          />
        )}
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
