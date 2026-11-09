"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DeleteWorkspaceDialog } from "@/components/delete-workspace-dialog";
import { WorkspaceVisibilityDialog } from "@/components/workspace-visibility-dialog";
import { useTeamLiveUpdates } from "@/hooks/use-team-live-updates";
import { useTeamQuery } from "@/hooks/use-team-query";
import type { TeamStatus } from "@/types";

import { useCollapsedGroups } from "./client/use-collapsed-groups";
import { useDragEnd } from "./client/use-drag-end";
import { useExcludedMembers } from "./client/use-excluded-members";
import { useTeamMembership } from "./client/use-team-membership";
import { useTeamNameEdit } from "./client/use-team-name-edit";
import { TeamSkeleton } from "./team-skeleton";
import { TeamUnavailable } from "./team-unavailable";
import { TeamWorkspace } from "./team-workspace";

const DndWrapper = dynamic(
  async () => {
    const { DndWrapper: Component } = await import("./dnd-wrapper");

    return Component;
  },
  { loading: () => <TeamSkeleton />, ssr: false },
);

type TeamPageClientProps = {
  hasPassword?: boolean;
  invitationId?: string;
  inviteMismatch?: { invitedEmailMasked: string };
  inviterName?: string;
  isArchived: boolean;
  isAuthenticated: boolean;
  isPrivate: boolean;
  returnTo: string;
  spaceId: string | null;
  teamId: string;
  teamStatus: TeamStatus;
  userId?: string;
};

const TeamPageClient = ({
  hasPassword = false,
  invitationId,
  inviteMismatch,
  inviterName,
  isArchived,
  isAuthenticated,
  isPrivate,
  returnTo,
  spaceId,
  teamId,
  teamStatus: initialStatus,
  userId,
}: TeamPageClientProps) => {
  const { push, refresh } = useRouter();
  const [isVisibilityOpen, setIsVisibilityOpen] = useState(false);
  const [activeDragType, setActiveDragType] = useState<"group" | "member" | null>(null);
  const [isDeleteWorkspaceOpen, setIsDeleteWorkspaceOpen] = useState(false);

  const liveStatus = useTeamLiveUpdates({ refresh, teamId });

  const {
    data: teamData,
    error: teamError,
    isFetching,
    refetch,
  } = useTeamQuery({ isLive: liveStatus === "live", teamId });

  useEffect(() => {
    if (teamError) {
      toast.error(teamError.message, { id: "team-query-error" });

      return;
    }

    toast.dismiss("team-query-error");
  }, [teamError]);

  const members = teamData?.team.members ?? [];
  const groups = teamData?.team.groups ?? [];

  const {
    currentUserId,
    handleRequestJoin,
    hasClaimedProfile,
    isAdmin,
    isMember,
    isRequestingJoin,
    teamStatus,
  } = useTeamMembership({ initialStatus, members, teamId, userId });

  const teamName = teamData?.team.name ?? "";

  const {
    displayName,
    handleCancelEditName,
    handleSaveName,
    handleStartEditName,
    isEditingName,
    setEditingTeamName,
  } = useTeamNameEdit({ isAdmin, teamId, teamName });

  const { collapsedGroupIds, toggleGroupCollapse } = useCollapsedGroups(members, groups);
  const { excludedMemberIds, setExcludedMemberIds } = useExcludedMembers();

  const orderedMembers = [...members].toSorted((a, b) => a.order - b.order);
  const orderedGroups = [...groups].toSorted((a, b) => a.order - b.order);

  const { handleDragEnd } = useDragEnd({ orderedGroups, orderedMembers, teamId });

  const handleDragTypeChange = (dragType: "group" | "member" | null) => {
    setActiveDragType(dragType);
  };

  const isLoaded = Boolean(teamData?.team);

  const mainContent = (
    <>
      <TeamWorkspace
        activeDragType={activeDragType}
        collapsedGroupIds={collapsedGroupIds}
        currentUserId={currentUserId}
        excludedMemberIds={excludedMemberIds}
        groups={groups}
        membership={{
          hasClaimedProfile,
          invitationId,
          inviteMismatch,
          inviterName,
          isAdmin,
          isAuthenticated,
          isMember,
          isRequestingJoin,
          members,
          onRequestJoin: () => {
            void handleRequestJoin();
          },
          returnTo,
          teamId,
          teamName,
          teamStatus,
        }}
        nav={{
          canDeleteWorkspace: spaceId !== null,
          isAdmin,
          isArchived,
          isAuthenticated,
          isEditingName,
          isPrivate,
          onCancelEdit: handleCancelEditName,
          onDeleteWorkspace: () => {
            setIsDeleteWorkspaceOpen(true);
          },
          onEditName: handleStartEditName,
          onEditVisibility: () => {
            setIsVisibilityOpen(true);
          },
          onNameChange: setEditingTeamName,
          onSaveName: handleSaveName,
          teamName: displayName,
          variant: "team",
        }}
        onExcludedMemberIdsChange={setExcludedMemberIds}
        onToggleGroupCollapse={toggleGroupCollapse}
      />

      {spaceId !== null && isVisibilityOpen && (
        <WorkspaceVisibilityDialog
          hasPassword={hasPassword}
          isPrivate={isPrivate}
          onOpenChange={setIsVisibilityOpen}
          onSaved={refresh}
          open={isVisibilityOpen}
          spaceId={spaceId}
        />
      )}
      {spaceId !== null && (
        <DeleteWorkspaceDialog
          onDeleted={() => {
            push("/");
          }}
          onOpenChange={setIsDeleteWorkspaceOpen}
          open={isDeleteWorkspaceOpen}
          spaceId={spaceId}
          teamName={displayName}
        />
      )}
    </>
  );

  if (teamError && !isLoaded) {
    return (
      <TeamUnavailable
        isRetrying={isFetching}
        message={teamError.message}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (!isLoaded) {
    return <TeamSkeleton />;
  }

  if (!isAdmin) {
    return mainContent;
  }

  return (
    <DndWrapper
      groups={groups}
      members={members}
      onDragEnd={handleDragEnd}
      onDragTypeChange={handleDragTypeChange}
    >
      {mainContent}
    </DndWrapper>
  );
};

export { TeamPageClient };
