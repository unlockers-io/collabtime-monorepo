"use client";

import { toast } from "@repo/ui/components/sonner";
import { Spinner } from "@repo/ui/components/spinner";
import { captureException } from "@sentry/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DeleteWorkspaceDialog } from "@/components/delete-workspace-dialog";
import { Nav } from "@/components/nav";
import { createTeam } from "@/lib/actions/team-create";
import { queryKeys } from "@/lib/query-keys";
import { getUserTimezone } from "@/lib/timezones";

import { ArchivedTeamsList } from "./home-client/archived-teams-list";
import { InvitationsList } from "./home-client/invitations-list";
import { TeamsList } from "./home-client/teams-list";
import type { WorkspaceToDelete } from "./home-client/types";
import { useInvitations } from "./home-client/use-invitations";
import { useMyTeams } from "./home-client/use-my-teams";

const HomeClient = () => {
  const { push } = useRouter();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<WorkspaceToDelete | null>(null);

  const { handleAcceptInvitation, handleDeclineInvitation, invitations, processingInvitations } =
    useInvitations();
  const { handleToggleArchive, isLoadingTeams, myTeams, processingArchive } = useMyTeams();

  const handleWorkspaceDeleted = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.myTeams });
  };

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

  const activeTeams = myTeams.filter((team) => team.archivedAt === null);
  const archivedTeams = myTeams.filter((team) => team.archivedAt !== null);

  return (
    <div className="flex flex-1 flex-col">
      <Nav isAuthenticated />

      <main
        className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-10 px-4 py-8 sm:gap-12 sm:px-6"
        id="main"
      >
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex flex-col gap-2 sm:gap-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              Collab Time
            </h1>
            <p className="max-w-sm text-base text-pretty text-muted-foreground sm:text-lg">
              Visualize your team&apos;s working hours across timezones. Find the perfect moment to
              connect.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-4">
          <button
            className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 sm:h-14 sm:w-auto sm:min-w-72 sm:gap-3 sm:px-8 sm:text-lg"
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
                Create Team Workspace
                <ArrowRight className="size-5 shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
              </>
            )}
          </button>
        </div>

        <InvitationsList
          invitations={invitations}
          onAccept={(invitation) => {
            void handleAcceptInvitation(invitation);
          }}
          onDecline={(invitation) => {
            void handleDeclineInvitation(invitation);
          }}
          processingInvitations={processingInvitations}
        />

        {!isLoadingTeams && (
          <TeamsList
            onArchive={(team) => {
              void handleToggleArchive(team, true);
            }}
            onRequestDelete={setWorkspaceToDelete}
            processingArchive={processingArchive}
            teams={activeTeams}
          />
        )}

        {!isLoadingTeams && (
          <ArchivedTeamsList
            onRequestDelete={setWorkspaceToDelete}
            onUnarchive={(team) => {
              void handleToggleArchive(team, false);
            }}
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
