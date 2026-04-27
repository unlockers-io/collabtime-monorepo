"use client";

import { Clock, FolderKanban, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AddGroupDialog } from "@/components/add-group-dialog";
import { AddMemberDialog } from "@/components/add-member-dialog";
import { DeleteWorkspaceDialog } from "@/components/delete-workspace-dialog";
import { ImportMembersDialog } from "@/components/import-members-dialog";
import { JoinRequestsPanel } from "@/components/join-requests-panel";
import { Nav } from "@/components/nav";
import { useRealtimeReady } from "@/components/providers";
import { TeamInsights } from "@/components/team-insights";
import { TimezoneVisualizer } from "@/components/timezone-visualizer";
import { useTeamQuery } from "@/hooks/use-team-query";
import { requestToJoin } from "@/lib/actions/join-requests";
import { getTeamMembershipRole } from "@/lib/actions/team-read";
import type { TeamStatus } from "@/types";

import { GroupsGrid } from "./client/groups-grid";
import { JoinPrompt } from "./client/join-prompt";
import { MembersGrid } from "./client/members-grid";
import { RealtimeSubscription } from "./client/realtime-subscription";
import { useCollapsedGroups } from "./client/use-collapsed-groups";
import { useDragEnd } from "./client/use-drag-end";
import { useTeamCacheUpdaters } from "./client/use-team-cache-updaters";
import { useTeamNameEdit } from "./client/use-team-name-edit";
import Loading from "./loading";

// oxlint-disable-next-line promise/prefer-await-to-then -- next/dynamic requires .then() to remap a named export onto `default`
const DndWrapper = dynamic(() => import("./dnd-wrapper").then((m) => ({ default: m.DndWrapper })), {
  ssr: false,
});

type TeamPageClientProps = {
  isAuthenticated: boolean;
  spaceId: string | null;
  teamId: string;
  teamStatus: TeamStatus;
  userId?: string;
};

const TeamPageClient = ({
  isAuthenticated,
  spaceId,
  teamId,
  teamStatus: initialStatus,
  userId,
}: TeamPageClientProps) => {
  const router = useRouter();
  const [teamStatus, setTeamStatus] = useState<TeamStatus>(initialStatus);
  const [activeDragType, setActiveDragType] = useState<"group" | "member" | null>(null);
  const [isRequestingJoin, setIsRequestingJoin] = useState(false);
  const [isDeleteWorkspaceOpen, setIsDeleteWorkspaceOpen] = useState(false);
  const lastRemovalRef = useRef<{ id: string; ts: number }>({ id: "", ts: 0 });

  const { data: teamData, error: teamError } = useTeamQuery({ teamId });

  // Resolve admin status client-side when server-side session detection fails
  useEffect(() => {
    if (teamStatus !== "none" || !userId) {
      return;
    }
    const resolveRole = async () => {
      const role = await getTeamMembershipRole(teamId, userId);
      if (role) {
        setTeamStatus(role);
      }
    };
    void resolveRole();
  }, [userId, teamId, teamStatus]);

  const isAdmin = teamStatus === "ADMIN";
  const isMember = teamStatus === "ADMIN" || teamStatus === "MEMBER";

  const {
    handleGroupAdded,
    handleGroupRemoved,
    handleGroupUpdated,
    handleMemberAdded,
    handleMemberRemoved,
    handleMemberUpdated,
    updateTeamCache,
  } = useTeamCacheUpdaters(teamId);

  useEffect(() => {
    if (teamError) {
      toast.error(teamError.message);
    }
  }, [teamError]);

  const members = teamData?.team?.members ?? [];
  const groups = teamData?.team?.groups ?? [];

  const currentUserId = isMember ? userId : undefined;
  const hasClaimedProfile = Boolean(
    currentUserId && members.some((m) => m.userId === currentUserId),
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

  const realtimeReady = useRealtimeReady();

  const handleRequestJoin = async () => {
    setIsRequestingJoin(true);
    try {
      const result = await requestToJoin(teamId);
      if (result.success) {
        setTeamStatus("PENDING");
        toast.success("Join request sent! The team admin will review it.");
      } else {
        toast.error(result.error);
      }
    } catch {
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
    <motion.div
      animate={{ opacity: 1 }}
      className="min-h-screen w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-12"
      initial={{ opacity: 0 }}
      key="content"
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <main className="mx-auto flex w-full max-w-450 flex-col gap-6">
        {/* Header */}
        <Nav
          canDeleteWorkspace={spaceId !== null}
          isAdmin={isAdmin}
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

        {/* Team Insights */}
        {members.length > 0 && (
          <section>
            <TeamInsights groups={groups} members={orderedMembers} />
          </section>
        )}

        {/* Timezone Visualizer */}
        {members.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-0.5 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Working Hours Overview
              </h2>
              <p className="text-xs text-muted-foreground">Times shown in your local timezone</p>
            </div>
            <div className="p-4 sm:p-6">
              <TimezoneVisualizer
                collapsedGroupIds={collapsedGroupIds}
                groups={groups}
                members={orderedMembers}
                onToggleGroupCollapse={toggleGroupCollapse}
              />
            </div>
          </section>
        )}

        {/* Team Members & Groups */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Team Members */}
          <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Users className="h-5 w-5 text-muted-foreground" />
                Team Members
              </h2>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                {members.length}
              </span>
            </div>

            <MembersGrid
              currentUserId={currentUserId}
              groups={groups}
              hasClaimedProfile={hasClaimedProfile}
              isAdmin={isAdmin}
              onMemberRemoved={handleMemberRemoved}
              onMemberUpdated={handleMemberUpdated}
              orderedMembers={orderedMembers}
              teamId={teamId}
            />

            {isAdmin && (
              <div className="flex flex-col gap-2">
                <AddMemberDialog
                  groups={groups}
                  isFirstMember={members.length === 0}
                  onMemberAdded={handleMemberAdded}
                  teamId={teamId}
                />
                <ImportMembersDialog teamId={teamId} />
                <JoinRequestsPanel teamId={teamId} />
              </div>
            )}
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
          </section>

          {/* Groups */}
          <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <FolderKanban className="h-5 w-5 text-muted-foreground" />
                Groups
              </h2>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                {groups.length}
              </span>
            </div>

            <GroupsGrid
              activeDragType={activeDragType}
              isAdmin={isAdmin}
              members={members}
              onGroupRemoved={handleGroupRemoved}
              onGroupUpdated={handleGroupUpdated}
              orderedGroups={orderedGroups}
              teamId={teamId}
            />

            {isAdmin && <AddGroupDialog onGroupAdded={handleGroupAdded} teamId={teamId} />}
          </section>
        </div>
      </main>

      {spaceId !== null && (
        <DeleteWorkspaceDialog
          onDeleted={() => {
            router.push("/");
          }}
          onOpenChange={setIsDeleteWorkspaceOpen}
          open={isDeleteWorkspaceOpen}
          spaceId={spaceId}
          teamName={displayName}
        />
      )}
    </motion.div>
  );

  const skeleton = (
    <motion.div exit={{ opacity: 0 }} key="skeleton" transition={{ duration: 0.2 }}>
      <Loading />
    </motion.div>
  );

  if (!isAdmin) {
    return (
      <AnimatePresence mode="wait">
        {!isLoaded ? (
          skeleton
        ) : (
          <>
            {realtimeReady && isMember && (
              <RealtimeSubscription
                lastRemovalRef={lastRemovalRef}
                teamId={teamId}
                updateTeamCache={updateTeamCache}
              />
            )}
            {mainContent}
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {!isLoaded ? (
        skeleton
      ) : (
        <DndWrapper
          groups={groups}
          hasClaimedProfile={hasClaimedProfile}
          members={members}
          onDragEnd={handleDragEnd}
          onDragTypeChange={handleDragTypeChange}
          teamId={teamId}
        >
          {realtimeReady && isMember && (
            <RealtimeSubscription
              lastRemovalRef={lastRemovalRef}
              teamId={teamId}
              updateTeamCache={updateTeamCache}
            />
          )}
          {mainContent}
        </DndWrapper>
      )}
    </AnimatePresence>
  );
};

export { TeamPageClient };
