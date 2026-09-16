"use client";

import { Clock, FolderKanban, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AddGroupDialog } from "@/components/add-group-dialog";
import { AddMemberDialog } from "@/components/add-member-dialog";
import { DeleteWorkspaceDialog } from "@/components/delete-workspace-dialog";
import { ImportMembersDialog } from "@/components/import-members-dialog";
import { Nav } from "@/components/nav";
import {
  SectionCard,
  SectionCardContent,
  SectionCardCount,
  SectionCardFooter,
  SectionCardHeader,
  SectionCardTitle,
} from "@/components/section-card";
import { TeamInsights } from "@/components/team-insights";
import { TimezoneVisualizer } from "@/components/timezone-visualizer";
import { WorkspaceVisibilityDialog } from "@/components/workspace-visibility-dialog";
import { useTeamLiveSync } from "@/hooks/use-team-live-sync";
import { useTeamMutation, useTeamQuery } from "@/hooks/use-team-query";
import type { TeamStatus } from "@/types";

import { GroupsGrid } from "./client/groups-grid";
import { MembersGrid } from "./client/members-grid";
import { MembershipActions } from "./client/membership-actions";
import { useCollapsedGroups } from "./client/use-collapsed-groups";
import { useDragEnd } from "./client/use-drag-end";
import { useTeamMembership } from "./client/use-team-membership";
import { useTeamNameEdit } from "./client/use-team-name-edit";
import Loading from "./loading";
import { TeamUnavailable } from "./team-unavailable";

const DndWrapper = dynamic(
  async () => {
    const { DndWrapper: Component } = await import("./dnd-wrapper");
    return Component;
  },
  { ssr: false },
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

  // oxlint-disable-next-line node/no-sync -- This React hook subscribes to SSE; it performs no synchronous I/O.
  const liveStatus = useTeamLiveSync({ refresh, teamId });
  const {
    data: teamData,
    error: teamError,
    isFetching,
    refetch,
  } = useTeamQuery({ isLive: liveStatus === "live", teamId });

  const teamMutation = useTeamMutation(teamId);

  useEffect(() => {
    if (teamError) {
      toast.error(teamError.message, { id: "team-query-error" });
      return;
    }
    toast.dismiss("team-query-error");
  }, [teamError]);

  const members = teamData?.team?.members ?? [];
  const groups = teamData?.team?.groups ?? [];

  const {
    currentUserId,
    handleRequestJoin,
    hasClaimedProfile,
    isAdmin,
    isMember,
    isRequestingJoin,
    teamStatus,
  } = useTeamMembership({ initialStatus, members, teamId, userId });

  const teamName = teamData?.team?.name ?? "";

  const {
    displayName,
    handleCancelEditName,
    handleSaveName,
    handleStartEditName,
    isEditingName,
    setEditingTeamName,
  } = useTeamNameEdit({ isAdmin, teamId, teamName });

  const { collapsedGroupIds, toggleGroupCollapse } = useCollapsedGroups(members);

  const orderedMembers = [...members].toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const orderedGroups = [...groups].toSorted((a, b) => a.order - b.order);

  const { handleDragEnd } = useDragEnd({
    groups,
    isAdmin,
    members,
    orderedGroups,
    orderedMembers,
    teamId,
    teamMutation,
  });

  const handleDragTypeChange = (dragType: "group" | "member" | null) => {
    setActiveDragType(dragType);
  };

  const isLoaded = Boolean(teamData?.team);

  const mainContent = (
    <div className="min-h-dvh w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
      <main className="mx-auto flex w-full max-w-450 flex-col gap-10" id="main">
        <Nav
          canDeleteWorkspace={spaceId !== null}
          isAdmin={isAdmin}
          isArchived={isArchived}
          isAuthenticated={isAuthenticated}
          isEditingName={isEditingName}
          isPrivate={isPrivate}
          onCancelEdit={handleCancelEditName}
          onDeleteWorkspace={() => {
            setIsDeleteWorkspaceOpen(true);
          }}
          onEditName={handleStartEditName}
          onEditVisibility={() => {
            setIsVisibilityOpen(true);
          }}
          onNameChange={setEditingTeamName}
          onSaveName={handleSaveName}
          teamName={displayName}
          variant="team"
        />

        {members.length > 0 && (
          <SectionCard>
            <SectionCardHeader>
              <SectionCardTitle description="Times shown in your local timezone" icon={Clock}>
                Working hours
              </SectionCardTitle>
            </SectionCardHeader>
            <SectionCardContent>
              <TimezoneVisualizer
                collapsedGroupIds={collapsedGroupIds}
                groups={groups}
                members={orderedMembers}
                onToggleGroupCollapse={toggleGroupCollapse}
              />
            </SectionCardContent>
          </SectionCard>
        )}

        {members.length > 0 && <TeamInsights groups={groups} members={orderedMembers} />}

        <div className="grid grid-cols-1 items-start gap-10 xl:grid-cols-team [&>*]:min-w-0">
          <SectionCard>
            <SectionCardHeader>
              <SectionCardTitle icon={Users}>Team Members</SectionCardTitle>
              <SectionCardCount>{members.length}</SectionCardCount>
            </SectionCardHeader>
            <SectionCardContent className="flex flex-col gap-4">
              <MembersGrid
                currentUserId={currentUserId}
                groups={groups}
                hasClaimedProfile={hasClaimedProfile}
                isAdmin={isAdmin}
                orderedMembers={orderedMembers}
                teamId={teamId}
              />

              <MembershipActions
                hasClaimedProfile={hasClaimedProfile}
                invitationId={invitationId}
                inviteMismatch={inviteMismatch}
                inviterName={inviterName}
                isAdmin={isAdmin}
                isAuthenticated={isAuthenticated}
                isMember={isMember}
                isRequestingJoin={isRequestingJoin}
                members={members}
                onRequestJoin={() => {
                  void handleRequestJoin();
                }}
                returnTo={returnTo}
                teamId={teamId}
                teamName={teamName}
                teamStatus={teamStatus}
              />
            </SectionCardContent>
            {isAdmin && (
              <SectionCardFooter className="justify-end">
                <ImportMembersDialog teamId={teamId} />
                <AddMemberDialog
                  groups={groups}
                  isFirstMember={members.length === 0}
                  teamId={teamId}
                />
              </SectionCardFooter>
            )}
          </SectionCard>

          <SectionCard>
            <SectionCardHeader>
              <SectionCardTitle icon={FolderKanban}>Groups</SectionCardTitle>
              <SectionCardCount>{groups.length}</SectionCardCount>
            </SectionCardHeader>
            <SectionCardContent>
              <GroupsGrid
                activeDragType={activeDragType}
                isAdmin={isAdmin}
                members={members}
                orderedGroups={orderedGroups}
                teamId={teamId}
              />
            </SectionCardContent>
            {isAdmin && (
              <SectionCardFooter className="justify-end">
                <AddGroupDialog teamId={teamId} />
              </SectionCardFooter>
            )}
          </SectionCard>
        </div>
      </main>

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
    </div>
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
    return <Loading />;
  }

  if (!isAdmin) {
    return mainContent;
  }

  return (
    <DndWrapper
      groups={groups}
      hasClaimedProfile={hasClaimedProfile}
      members={members}
      onDragEnd={handleDragEnd}
      onDragTypeChange={handleDragTypeChange}
      teamId={teamId}
    >
      {mainContent}
    </DndWrapper>
  );
};

export { TeamPageClient };
