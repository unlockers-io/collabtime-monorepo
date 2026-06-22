"use client";
"use no memo";

import { toast } from "@repo/ui/components/sonner";
import { captureException } from "@sentry/nextjs";
import { useQuery } from "@tanstack/react-query";
import { Clock, FolderKanban, Users } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AddGroupDialog } from "@/components/add-group-dialog";
import { AddMemberDialog } from "@/components/add-member-dialog";
import { DeleteWorkspaceDialog } from "@/components/delete-workspace-dialog";
import { ImportMembersDialog } from "@/components/import-members-dialog";
import { JoinRequestsPanel } from "@/components/join-requests-panel";
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
import { useTeamQuery, useUpdateTeamCache } from "@/hooks/use-team-query";
import { requestToJoin } from "@/lib/actions/join-requests";
import { getTeamMembershipRole } from "@/lib/actions/team-read";
import type { TeamStatus } from "@/types";

import { GroupsGrid } from "./client/groups-grid";
import { JoinPrompt } from "./client/join-prompt";
import { MembersGrid } from "./client/members-grid";
import { useCollapsedGroups } from "./client/use-collapsed-groups";
import { useDragEnd } from "./client/use-drag-end";
import { useTeamNameEdit } from "./client/use-team-name-edit";
import Loading from "./loading";

const DndWrapper = dynamic(
  async () => {
    const { DndWrapper: Component } = await import("./dnd-wrapper");
    return Component;
  },
  { ssr: false },
);

type TeamPageClientProps = {
  isArchived: boolean;
  isAuthenticated: boolean;
  spaceId: string | null;
  teamId: string;
  teamStatus: TeamStatus;
  userId?: string;
};

const TeamPageClient = ({
  isArchived,
  isAuthenticated,
  spaceId,
  teamId,
  teamStatus: initialStatus,
  userId,
}: TeamPageClientProps) => {
  const { push } = useRouter();
  const [statusOverride, setStatusOverride] = useState<TeamStatus | null>(null);
  const [activeDragType, setActiveDragType] = useState<"group" | "member" | null>(null);
  const [isRequestingJoin, setIsRequestingJoin] = useState(false);
  const [isDeleteWorkspaceOpen, setIsDeleteWorkspaceOpen] = useState(false);

  const { data: teamData, error: teamError } = useTeamQuery({ teamId });

  // Resolve admin status client-side when server-side session detection fails
  const { data: resolvedRole, error: resolvedRoleError } = useQuery({
    enabled: initialStatus === "none" && Boolean(userId),
    queryFn: () => (userId ? getTeamMembershipRole(teamId, userId) : null),
    queryKey: ["membership-role", teamId, userId],
  });

  // Cached client resolution only fills the gap when the server couldn't
  // resolve a status — a fresh non-"none" initialStatus from an RSC refresh
  // must outrank stale query cache (disabled queries still serve cached data).
  const teamStatus: TeamStatus =
    statusOverride ?? (initialStatus === "none" ? (resolvedRole ?? "none") : initialStatus);

  const isAdmin = teamStatus === "ADMIN";
  const isMember = teamStatus === "ADMIN" || teamStatus === "MEMBER";

  // Kept for drag-end optimistic update + revert; other mutation sites invalidate the team query directly.
  const updateTeamCache = useUpdateTeamCache();

  useEffect(() => {
    // The role lookup is a silent fallback (the action itself returns null on
    // failure), so transport errors must be reported rather than swallowed.
    if (resolvedRoleError) {
      captureException(resolvedRoleError);
    }
  }, [resolvedRoleError]);

  useEffect(() => {
    // Stable id: the team query polls every 20s, so repeated failures replace
    // the toast instead of stacking a new one per refetch.
    if (teamError) {
      toast.error(teamError.message, { id: "team-query-error" });
      return;
    }
    toast.dismiss("team-query-error");
  }, [teamError]);

  const members = teamData?.team?.members ?? [];
  const groups = teamData?.team?.groups ?? [];

  const currentUserId = isMember ? userId : undefined;
  const hasClaimedProfile = Boolean(
    currentUserId && members.some((member) => member.userId === currentUserId),
  );

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

  const handleRequestJoin = async () => {
    setIsRequestingJoin(true);
    try {
      const result = await requestToJoin(teamId);
      if (result.success) {
        setStatusOverride("PENDING");
        toast.success("Join request sent! The team admin will review it.");
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      captureException(error);
      toast.error("Failed to send join request");
    } finally {
      setIsRequestingJoin(false);
    }
  };

  const orderedMembers = [...members].toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const orderedGroups = [...groups].toSorted((a, b) => a.order - b.order);

  const { handleDragEnd } = useDragEnd({
    groups,
    isAdmin,
    members,
    orderedGroups,
    orderedMembers,
    teamId,
    updateTeamCache,
  });

  const handleDragTypeChange = (dragType: "group" | "member" | null) => {
    setActiveDragType(dragType);
  };

  const isLoaded = Boolean(teamData?.team);

  const mainContent = (
    <m.div
      animate={{ opacity: 1 }}
      className="min-h-dvh w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-12"
      initial={{ opacity: 0 }}
      key="content"
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <main className="mx-auto flex w-full max-w-450 flex-col gap-6" id="main">
        <Nav
          canDeleteWorkspace={spaceId !== null}
          isAdmin={isAdmin}
          isArchived={isArchived}
          isAuthenticated={isAuthenticated}
          isEditingName={isEditingName}
          onCancelEdit={handleCancelEditName}
          onDeleteWorkspace={() => setIsDeleteWorkspaceOpen(true)}
          onEditName={handleStartEditName}
          onNameChange={setEditingTeamName}
          onSaveName={handleSaveName}
          teamName={displayName}
          variant="team"
        />

        {members.length > 0 && <TeamInsights groups={groups} members={orderedMembers} />}

        {members.length > 0 && (
          <SectionCard>
            <SectionCardHeader bordered>
              <SectionCardTitle description="Times shown in your local timezone" icon={Clock}>
                Working Hours Overview
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

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2 [&>*]:min-w-0">
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

              {isAdmin && <JoinRequestsPanel teamId={teamId} />}
              {!isAdmin && isMember && (
                <p className="text-center text-sm text-muted-foreground">
                  You are a member of this team
                </p>
              )}
              {!isAdmin && !isMember && (
                <JoinPrompt
                  isAuthenticated={isAuthenticated}
                  isRequestingJoin={isRequestingJoin}
                  onRequestJoin={handleRequestJoin}
                  teamId={teamId}
                  teamStatus={teamStatus}
                />
              )}
            </SectionCardContent>
            {isAdmin && (
              <SectionCardFooter bordered className="justify-end">
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
              <SectionCardFooter bordered className="justify-end">
                <AddGroupDialog teamId={teamId} />
              </SectionCardFooter>
            )}
          </SectionCard>
        </div>
      </main>

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
    </m.div>
  );

  const skeleton = (
    <m.div exit={{ opacity: 0 }} key="skeleton" transition={{ duration: 0.2 }}>
      <Loading />
    </m.div>
  );

  if (!isAdmin) {
    return <AnimatePresence mode="wait">{isLoaded ? mainContent : skeleton}</AnimatePresence>;
  }

  return (
    <AnimatePresence mode="wait">
      {isLoaded ? (
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
      ) : (
        skeleton
      )}
    </AnimatePresence>
  );
};

export { TeamPageClient };
