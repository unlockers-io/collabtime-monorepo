"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { DeleteWorkspaceDialog } from "@/components/delete-workspace-dialog";
import { queryKeys } from "@/lib/query-keys";

import { ArchivedTeamsList } from "./archived-teams-list";
import { EmptyWorkspaces } from "./empty-workspaces";
import { InvitationsList } from "./invitations-list";
import { LoadErrorRow } from "./load-error-row";
import { TeamsList } from "./teams-list";
import type { WorkspaceToDelete } from "./types";
import { useInvitations } from "./use-invitations";
import { useMyTeams } from "./use-my-teams";

const HomeLists = () => {
  const queryClient = useQueryClient();
  const [workspaceToDelete, setWorkspaceToDelete] = useState<WorkspaceToDelete | null>(null);

  const {
    handleAcceptInvitation,
    handleDeclineInvitation,
    invitations,
    isInvitationPending,
    isInvitationsError,
    isLoadingInvitations,
    refetchInvitations,
  } = useInvitations();
  const {
    handleToggleArchive,
    isArchivePending,
    isLoadingTeams,
    isTeamsError,
    myTeams,
    refetchTeams,
  } = useMyTeams();

  const handleWorkspaceDeleted = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.myTeams });
  };

  const activeTeams = myTeams.filter((team) => team.archivedAt === null);
  const archivedTeams = myTeams.filter((team) => team.archivedAt !== null);
  const isEmpty =
    !isLoadingTeams &&
    !isLoadingInvitations &&
    !isTeamsError &&
    myTeams.length === 0 &&
    invitations.length === 0;

  return (
    <>
      {isTeamsError && (
        <LoadErrorRow
          label="Couldn't load your workspaces"
          onRetry={() => {
            void refetchTeams();
          }}
        />
      )}
      {isInvitationsError && (
        <LoadErrorRow
          label="Couldn't load your invitations"
          onRetry={() => {
            void refetchInvitations();
          }}
        />
      )}
      {isEmpty && <EmptyWorkspaces />}
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
          open
          spaceId={workspaceToDelete.spaceId}
          teamName={workspaceToDelete.teamName}
        />
      )}
    </>
  );
};

export { HomeLists };
