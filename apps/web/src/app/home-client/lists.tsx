"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { DeleteWorkspaceDialog } from "@/components/delete-workspace-dialog";
import { queryKeys } from "@/lib/query-keys";

import { ArchivedTeamsList } from "./archived-teams-list";
import { InvitationsList } from "./invitations-list";
import { TeamsList } from "./teams-list";
import type { WorkspaceToDelete } from "./types";
import { useInvitations } from "./use-invitations";
import { useMyTeams } from "./use-my-teams";

const HomeLists = () => {
  const queryClient = useQueryClient();
  const [workspaceToDelete, setWorkspaceToDelete] = useState<WorkspaceToDelete | null>(null);

  const { handleAcceptInvitation, handleDeclineInvitation, invitations, isInvitationPending } =
    useInvitations();
  const { handleToggleArchive, isArchivePending, isLoadingTeams, myTeams } = useMyTeams();

  const handleWorkspaceDeleted = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.myTeams });
  };

  const activeTeams = myTeams.filter((team) => team.archivedAt === null);
  const archivedTeams = myTeams.filter((team) => team.archivedAt !== null);

  return (
    <>
      <InvitationsList
        invitations={invitations}
        isPending={isInvitationPending}
        onAccept={handleAcceptInvitation}
        onDecline={handleDeclineInvitation}
      />

      {!isLoadingTeams && (
        <TeamsList
          isArchivePending={isArchivePending}
          onArchive={(team) => {
            handleToggleArchive(team, true);
          }}
          onRequestDelete={setWorkspaceToDelete}
          teams={activeTeams}
        />
      )}

      {!isLoadingTeams && (
        <ArchivedTeamsList
          isArchivePending={isArchivePending}
          onRequestDelete={setWorkspaceToDelete}
          onUnarchive={(team) => {
            handleToggleArchive(team, false);
          }}
          teams={archivedTeams}
        />
      )}

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
    </>
  );
};

export { HomeLists };
