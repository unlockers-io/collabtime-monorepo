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
import { ViewerZoneNote } from "@/components/timezone-visualizer/viewer-zone-note";
import { WorkspaceVisibilityDialog } from "@/components/workspace-visibility-dialog";
import { useTeamLiveUpdates } from "@/hooks/use-team-live-updates";
import { useTeamQuery } from "@/hooks/use-team-query";

import { GroupsGrid } from "./client/groups-grid";
import { MembersGrid } from "./client/members-grid";
import { MembershipActions } from "./client/membership-actions";
import { useCollapsedGroups } from "./client/use-collapsed-groups";
import { useDragEnd } from "./client/use-drag-end";
import { useExcludedMembers } from "./client/use-excluded-members";
import { useTeamMembership } from "./client/use-team-membership";
import Loading from "./loading";
import { TeamNav } from "./team-nav";
import { TeamUnavailable } from "./team-unavailable";
import type { TeamPageOwner, TeamPageViewer } from "./viewer";

const DndWrapper = dynamic(
  async () => {
    const { DndWrapper: Component } = await import("./dnd-wrapper");

    return Component;
  },
  { ssr: false },
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
  const { currentUserId, hasClaimedProfile, isAdmin } = membership;
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
    <div className="min-h-dvh w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
      <main className="mx-auto flex w-full max-w-450 flex-col gap-10" id="main">
        <TeamNav
          isArchived={viewer.isArchived}
          isPrivate={isPrivate}
          navRole={membership.navRole}
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
          teamId={teamId}
          teamName={teamName}
        />

        {members.length > 0 && (
          <SectionCard>
            <SectionCardHeader>
              <SectionCardTitle description={<ViewerZoneNote />} icon={Clock}>
                Working hours
              </SectionCardTitle>
            </SectionCardHeader>
            <SectionCardContent>
              <TimezoneVisualizer
                collapsedGroupIds={collapsedGroupIds}
                excludedMemberIds={excludedMemberIds}
                groups={groups}
                members={orderedMembers}
                onExcludedMemberIdsChange={setExcludedMemberIds}
                onToggleGroupCollapse={toggleGroupCollapse}
              />
            </SectionCardContent>
          </SectionCard>
        )}

        {members.length > 0 && <TeamInsights groups={groups} members={orderedMembers} />}

        <div className="grid grid-cols-1 items-start gap-10 xl:grid-cols-team [&>*]:min-w-0">
          <SectionCard>
            <SectionCardHeader>
              <SectionCardTitle icon={Users}>Team members</SectionCardTitle>
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
                members={members}
                membership={membership}
                returnTo={returnTo}
                teamId={teamId}
                teamName={teamName}
                viewer={viewer}
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
      members={members}
      onDragEnd={handleDragEnd}
      onDragTypeChange={handleDragTypeChange}
    >
      {mainContent}
    </DndWrapper>
  );
};

export { TeamPageClient };
