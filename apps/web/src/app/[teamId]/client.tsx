"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DeleteWorkspaceDialog } from "@/components/delete-workspace-dialog";
import { WorkspaceVisibilityDialog } from "@/components/workspace-visibility-dialog";
import { useTeamLiveUpdates } from "@/hooks/use-team-live-updates";
import { useTeamQuery } from "@/hooks/use-team-query";

import { useCollapsedGroups } from "./client/use-collapsed-groups";
import { useDragEnd } from "./client/use-drag-end";
import { useExcludedMembers } from "./client/use-excluded-members";
import { useTeamMembership } from "./client/use-team-membership";
import { TeamSkeleton } from "./team-skeleton";
import { TeamUnavailable } from "./team-unavailable";
import { TeamWorkspace } from "./team-workspace";
import type { TeamPageOwner, TeamPageViewer } from "./viewer";

const DndWrapper = dynamic(
  async () => {
    const { DndWrapper: Component } = await import("./dnd-wrapper");

    return Component;
  },
  { loading: () => <TeamSkeleton />, ssr: false },
);

type TeamPageClientProps = {
  isPrivate: boolean;
  owner: TeamPageOwner | null;
  returnTo: string;
  teamId: string;
  viewer: TeamPageViewer;
};

const TeamPageClient = ({ isPrivate, owner, returnTo, teamId, viewer }: TeamPageClientProps) => {
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

  const members = teamData?.members ?? [];
  const groups = teamData?.groups ?? [];

  const membership = useTeamMembership({ members, teamId, viewer });
  const { isAdmin } = membership;
  const teamName = teamData?.name ?? "";

  const { collapsedGroupIds, toggleGroupCollapse } = useCollapsedGroups(members, groups);
  const { excludedMemberIds, setExcludedMemberIds } = useExcludedMembers();

  const orderedMembers = [...members].toSorted((a, b) => a.order - b.order);
  const orderedGroups = [...groups].toSorted((a, b) => a.order - b.order);

  const { handleDragEnd } = useDragEnd({ orderedGroups, orderedMembers, teamId });

  const handleDragTypeChange = (dragType: "group" | "member" | null) => {
    setActiveDragType(dragType);
  };

  const isLoaded = teamData !== undefined;

  const mainContent = (
    <>
      <TeamWorkspace
        activeDragType={activeDragType}
        collapsedGroupIds={collapsedGroupIds}
        excludedMemberIds={excludedMemberIds}
        groups={groups}
        isPrivate={isPrivate}
        members={members}
        membership={membership}
        onExcludedMemberIdsChange={setExcludedMemberIds}
        onToggleGroupCollapse={toggleGroupCollapse}
        owner={
          owner && {
            onDeleteWorkspace: () => {
              setIsDeleteWorkspaceOpen(true);
            },
            onEditVisibility: () => {
              setIsVisibilityOpen(true);
            },
          }
        }
        returnTo={returnTo}
        teamId={teamId}
        teamName={teamName}
        viewer={viewer}
      />

      {owner && isVisibilityOpen && (
        <WorkspaceVisibilityDialog
          hasPassword={owner.hasPassword}
          isPrivate={isPrivate}
          onOpenChange={setIsVisibilityOpen}
          onSaved={refresh}
          open={isVisibilityOpen}
          spaceId={owner.spaceId}
        />
      )}
      {owner && (
        <DeleteWorkspaceDialog
          onDeleted={() => {
            push("/");
          }}
          onOpenChange={setIsDeleteWorkspaceOpen}
          open={isDeleteWorkspaceOpen}
          spaceId={owner.spaceId}
          teamName={teamName}
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
