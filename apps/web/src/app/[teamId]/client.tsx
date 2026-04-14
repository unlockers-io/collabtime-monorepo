"use client";

import { type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { Button, buttonVariants } from "@repo/ui/components/button";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Spinner } from "@repo/ui/components/spinner";
import { cn } from "@repo/ui/lib/utils";
import { Clock, FolderKanban, LogIn, UserPlus, Users } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { AddGroupDialog } from "@/components/add-group-dialog";
import { AddMemberDialog } from "@/components/add-member-dialog";
import { GroupCard } from "@/components/group-card";
import { ImportMembersDialog } from "@/components/import-members-dialog";
import { JoinRequestsPanel } from "@/components/join-requests-panel";
import { MemberCard } from "@/components/member-card";
import { Nav } from "@/components/nav";
import { useRealtimeReady } from "@/components/providers";
import { SortableGroupCard } from "@/components/sortable-group-card";
import { SortableMemberCard } from "@/components/sortable-member-card";
import { TeamInsights } from "@/components/team-insights";
import { TimezoneVisualizer } from "@/components/timezone-visualizer";
import { useTeamQuery, useUpdateTeamCache } from "@/hooks/use-team-query";
import { reorderGroups } from "@/lib/actions/group-actions";
import { requestToJoin } from "@/lib/actions/join-requests";
import { updateTeamName, updateMember, reorderMembers } from "@/lib/actions/member-actions";
import { useRealtime } from "@/lib/realtime-client";
import type { TeamGroup, TeamMember, TeamStatus } from "@/types";

const DndWrapper = dynamic(() => import("./dnd-wrapper").then((m) => ({ default: m.DndWrapper })), {
  ssr: false,
});

import Loading from "./loading";

type TeamPageClientProps = {
  isAuthenticated: boolean;
  teamId: string;
  teamStatus: TeamStatus;
  userId?: string;
};

const COLLAPSED_GROUPS_KEY = "collabtime-collapsed-groups";

const TeamPageClient = ({
  teamId,
  isAuthenticated,
  teamStatus: initialStatus,
  userId,
}: TeamPageClientProps) => {
  const [teamStatus, setTeamStatus] = useState<TeamStatus>(initialStatus);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    if (typeof window === "undefined") {
      return new Set();
    }
    const stored = localStorage.getItem(COLLAPSED_GROUPS_KEY);
    return stored ? new Set(JSON.parse(stored) as Array<string>) : new Set();
  });
  const [, startTransition] = useTransition();
  const [isMemberDragging, setIsMemberDragging] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingTeamName, setEditingTeamName] = useState("");
  const [isRequestingJoin, setIsRequestingJoin] = useState(false);
  const lastRemovalRef = useRef<{ id: string; ts: number }>({ id: "", ts: 0 });

  // Fetch team data with TanStack Query
  const { data: teamData, error: teamError } = useTeamQuery({ teamId });

  // Resolve admin status client-side when server-side session detection fails
  useEffect(() => {
    const resolveRole = async () => {
      if (teamStatus !== "none" || !userId) {
        return;
      }
      const { getTeamMembershipRole } = await import("@/lib/actions/team-read");
      const role = await getTeamMembershipRole(teamId, userId);
      if (role) {
        setTeamStatus(role);
      }
    };
    resolveRole();
  }, [userId, teamId, teamStatus]);

  const isAdmin = teamStatus === "ADMIN";
  const isMember = teamStatus === "ADMIN" || teamStatus === "MEMBER";

  const updateTeamCache = useUpdateTeamCache();

  useEffect(() => {
    if (teamError) {
      toast.error(teamError.message);
    }
  }, [teamError]);

  const members = useMemo(() => teamData?.team?.members ?? [], [teamData?.team?.members]);
  const groups = useMemo(() => teamData?.team?.groups ?? [], [teamData?.team?.groups]);

  const currentUserId = isMember ? userId : undefined;
  const hasClaimedProfile = useMemo(
    () => Boolean(currentUserId && members.some((m) => m.userId === currentUserId)),
    [currentUserId, members],
  );

  const teamName = teamData?.team?.name ?? "";
  const displayName = isEditingName ? editingTeamName : teamName;

  useEffect(() => {
    localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(Array.from(collapsedGroups)));
  }, [collapsedGroups]);

  const toggleGroupCollapse = useCallback(
    (groupId: string) => {
      setCollapsedGroups((prev) => {
        const next = new Set(prev);
        if (next.has(groupId)) {
          next.delete(groupId);
        } else {
          const collapsedAfter = new Set([...Array.from(prev), groupId]);
          const ungroupedCount = members.filter((m) => !m.groupId).length;
          const visibleGroupedCount = members.filter((m) => {
            if (!m.groupId) {
              return false;
            }
            return !collapsedAfter.has(m.groupId);
          }).length;
          const totalVisibleAfter = ungroupedCount + visibleGroupedCount;
          if (totalVisibleAfter > 0) {
            next.add(groupId);
          }
        }
        return next;
      });
    },
    [members],
  );

  // Realtime subscription is mounted as a separate component below,
  // gated on useRealtimeReady() so it only renders after the provider loads.
  const realtimeReady = useRealtimeReady();

  const handleStartEditName = useCallback(() => {
    setEditingTeamName(teamName);
    setIsEditingName(true);
  }, [teamName]);

  const handleSaveName = () => {
    if (!isAdmin) {
      return;
    }

    const trimmedName = editingTeamName.trim();
    setIsEditingName(false);

    if (trimmedName === teamName) {
      return;
    }

    startTransition(async () => {
      const result = await updateTeamName(teamId, trimmedName);
      if (!result.success) {
        toast.error(result.error);
      }
    });
  };

  const handleCancelEditName = useCallback(() => {
    setIsEditingName(false);
  }, []);

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

  const orderedMembers = useMemo(
    () => [...members].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [members],
  );

  const orderedGroups = useMemo(() => [...groups].sort((a, b) => a.order - b.order), [groups]);

  const memberIds = useMemo(() => orderedMembers.map((m) => m.id), [orderedMembers]);
  const groupIds = useMemo(() => orderedGroups.map((g) => g.id), [orderedGroups]);

  const collapsedGroupIds = useMemo(() => Array.from(collapsedGroups), [collapsedGroups]);

  // Callbacks for local state updates (realtime handles cross-user sync)
  const handleMemberAdded = useCallback(
    (newMember: TeamMember) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) {
          return prev;
        }
        if (prev.team.members.some((m) => m.id === newMember.id)) {
          return prev;
        }
        return {
          ...prev,
          team: {
            ...prev.team,
            members: [...prev.team.members, newMember],
          },
        };
      });
    },
    [teamId, updateTeamCache],
  );

  const handleMemberRemoved = useCallback(
    (memberId: string) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          team: {
            ...prev.team,
            members: prev.team.members.filter((m) => m.id !== memberId),
          },
        };
      });
    },
    [teamId, updateTeamCache],
  );

  const handleMemberUpdated = useCallback(
    (updatedMember: TeamMember) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          team: {
            ...prev.team,
            members: prev.team.members.map((m) => (m.id === updatedMember.id ? updatedMember : m)),
          },
        };
      });
    },
    [teamId, updateTeamCache],
  );

  const handleGroupAdded = useCallback(
    (newGroup: TeamGroup) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) {
          return prev;
        }
        if (prev.team.groups.some((g) => g.id === newGroup.id)) {
          return prev;
        }
        return {
          ...prev,
          team: {
            ...prev.team,
            groups: [...prev.team.groups, newGroup],
          },
        };
      });
    },
    [teamId, updateTeamCache],
  );

  const handleGroupUpdated = useCallback(
    (updatedGroup: TeamGroup) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          team: {
            ...prev.team,
            groups: prev.team.groups.map((g) => (g.id === updatedGroup.id ? updatedGroup : g)),
          },
        };
      });
    },
    [teamId, updateTeamCache],
  );

  const handleGroupRemoved = useCallback(
    (groupId: string) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          team: {
            ...prev.team,
            groups: prev.team.groups.filter((g) => g.id !== groupId),
            members: prev.team.members.map((m) =>
              m.groupId === groupId ? { ...m, groupId: undefined } : m,
            ),
          },
        };
      });
    },
    [teamId, updateTeamCache],
  );

  const handleMemberDroppedOnGroup = useCallback(
    async (memberId: string, groupId: string) => {
      if (!isAdmin) {
        toast.error("Admin access required");
        return;
      }

      const member = members.find((m) => m.id === memberId);
      if (!member) {
        return;
      }

      if (member.groupId === groupId) {
        return;
      }

      const previousGroupId = member.groupId;

      // Optimistic update
      updateTeamCache(teamId, (prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          team: {
            ...prev.team,
            members: prev.team.members.map((m) => (m.id === memberId ? { ...m, groupId } : m)),
          },
        };
      });

      const result = await updateMember(teamId, memberId, { groupId });

      if (result.success) {
        const group = groups.find((g) => g.id === groupId);
        toast.success(`${member.name} added to ${group?.name ?? "group"}`);
      } else {
        // Revert on failure
        updateTeamCache(teamId, (prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            team: {
              ...prev.team,
              members: prev.team.members.map((m) =>
                m.id === memberId ? { ...m, groupId: previousGroupId } : m,
              ),
            },
          };
        });
        toast.error(result.error);
      }
    },
    [isAdmin, members, groups, teamId, updateTeamCache],
  );

  const handleDragTypeChange = useCallback((dragType: "group" | "member" | null) => {
    setIsMemberDragging(dragType === "member");
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent, dragType: "group" | "member" | null) => {
      setIsMemberDragging(false);
      const { active, over } = event;

      if (!over || !isAdmin) {
        return;
      }

      const activeId = active.id as string;
      const overId = over.id as string;

      if (activeId === overId) {
        return;
      }

      if (dragType === "member") {
        const overIsMember = orderedMembers.some((m) => m.id === overId);
        if (overIsMember) {
          const oldIndex = orderedMembers.findIndex((m) => m.id === activeId);
          const newIndex = orderedMembers.findIndex((m) => m.id === overId);
          if (oldIndex === -1 || newIndex === -1) {
            return;
          }

          const newOrder = arrayMove(orderedMembers, oldIndex, newIndex);
          const newIds = newOrder.map((m) => m.id);

          updateTeamCache(teamId, (prev) => {
            if (!prev) {
              return prev;
            }
            const map = new Map(prev.team.members.map((m) => [m.id, m]));
            return {
              ...prev,
              team: {
                ...prev.team,
                members: newIds.map((id, i) => ({ ...map.get(id)!, order: i })),
              },
            };
          });

          const result = await reorderMembers(teamId, newIds);
          if (!result.success) {
            toast.error(result.error);
          }
        } else {
          const overIsGroup = orderedGroups.some((g) => g.id === overId);
          if (overIsGroup) {
            handleMemberDroppedOnGroup(activeId, overId);
          }
        }
      } else if (dragType === "group") {
        const oldIndex = orderedGroups.findIndex((g) => g.id === activeId);
        const newIndex = orderedGroups.findIndex((g) => g.id === overId);
        if (oldIndex === -1 || newIndex === -1) {
          return;
        }

        const newOrder = arrayMove(orderedGroups, oldIndex, newIndex);
        const newIds = newOrder.map((g) => g.id);

        updateTeamCache(teamId, (prev) => {
          if (!prev) {
            return prev;
          }
          const map = new Map(prev.team.groups.map((g) => [g.id, g]));
          return {
            ...prev,
            team: {
              ...prev.team,
              groups: newIds.map((id, i) => ({ ...map.get(id)!, order: i })),
            },
          };
        });

        const result = await reorderGroups(teamId, newIds);
        if (!result.success) {
          toast.error(result.error);
        }
      }
    },
    [isAdmin, orderedMembers, orderedGroups, teamId, updateTeamCache, handleMemberDroppedOnGroup],
  );

  if (!teamData?.team) {
    return <Loading />;
  }

  const membersGrid = (
    <>
      {members.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border bg-muted/50 px-6 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold text-foreground">Build your team</h3>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              Add team members to see their working hours and find the best times to collaborate
              across timezones.
            </p>
          </div>
        </div>
      ) : (
        <ScrollArea className="max-h-150">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 pr-4">
            {isAdmin ? (
              <SortableContext items={memberIds} strategy={rectSortingStrategy}>
                {orderedMembers.map((member) => (
                  <SortableMemberCard
                    key={member.id}
                    member={member}
                    teamId={teamId}
                    groups={groups}
                    canEdit={isAdmin}
                    currentUserId={currentUserId}
                    hasClaimedProfile={hasClaimedProfile}
                    onMemberRemoved={handleMemberRemoved}
                    onMemberUpdated={handleMemberUpdated}
                  />
                ))}
              </SortableContext>
            ) : (
              orderedMembers.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  teamId={teamId}
                  groups={groups}
                  canEdit={false}
                  currentUserId={currentUserId}
                  hasClaimedProfile={hasClaimedProfile}
                  onMemberRemoved={handleMemberRemoved}
                  onMemberUpdated={handleMemberUpdated}
                />
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </>
  );

  const groupsGrid = (
    <>
      {groups.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border bg-muted/50 px-6 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
            <FolderKanban className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold text-foreground">Organize with groups</h3>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              Create groups to organize team members by department, project, or location. Drag and
              drop members into groups to categorize them.
            </p>
          </div>
        </div>
      ) : (
        <ScrollArea className="max-h-150">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 pr-4">
            {isAdmin ? (
              <SortableContext items={groupIds} strategy={rectSortingStrategy}>
                {orderedGroups.map((group) => (
                  <SortableGroupCard
                    key={group.id}
                    group={group}
                    teamId={teamId}
                    memberCount={members.filter((m) => m.groupId === group.id).length}
                    canEdit={isAdmin}
                    isDropTarget={isMemberDragging}
                    onGroupUpdated={handleGroupUpdated}
                    onGroupRemoved={handleGroupRemoved}
                  />
                ))}
              </SortableContext>
            ) : (
              orderedGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  teamId={teamId}
                  memberCount={members.filter((m) => m.groupId === group.id).length}
                  canEdit={false}
                  onGroupUpdated={handleGroupUpdated}
                  onGroupRemoved={handleGroupRemoved}
                />
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </>
  );

  const mainContent = (
    <div className="min-h-screen w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
      <main className="mx-auto flex w-full max-w-450 flex-col gap-6">
        {/* Header */}
        <Nav
          variant="team"
          isAuthenticated={isAuthenticated}
          teamName={displayName}
          isAdmin={isAdmin}
          isEditingName={isEditingName}
          onEditName={handleStartEditName}
          onNameChange={setEditingTeamName}
          onSaveName={handleSaveName}
          onCancelEdit={handleCancelEditName}
        />

        {/* Team Insights */}
        {members.length > 0 && (
          <section>
            <TeamInsights members={orderedMembers} groups={groups} />
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
                members={orderedMembers}
                groups={groups}
                collapsedGroupIds={collapsedGroupIds}
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

            {membersGrid}

            {isAdmin ? (
              <div className="flex flex-col gap-2">
                <AddMemberDialog
                  teamId={teamId}
                  groups={groups}
                  onMemberAdded={handleMemberAdded}
                  isFirstMember={members.length === 0}
                />
                <ImportMembersDialog teamId={teamId} />
                <JoinRequestsPanel teamId={teamId} />
              </div>
            ) : !isMember ? (
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/50 px-4 py-3">
                {!isAuthenticated ? (
                  <>
                    <p className="text-sm text-muted-foreground">Sign in to request access</p>
                    <Link
                      href={`/login?redirect=/${teamId}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      Sign in
                    </Link>
                  </>
                ) : teamStatus === "PENDING" ? (
                  <p className="text-sm text-muted-foreground">
                    Your join request is pending admin approval.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Request access to edit this team
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRequestJoin}
                      disabled={isRequestingJoin}
                    >
                      {isRequestingJoin ? (
                        <Spinner className="mr-2 h-4 w-4" />
                      ) : (
                        <UserPlus className="mr-2 h-4 w-4" />
                      )}
                      Request to Join
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                You are a member of this team
              </p>
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

            {groupsGrid}

            {isAdmin && <AddGroupDialog teamId={teamId} onGroupAdded={handleGroupAdded} />}
          </section>
        </div>
      </main>
    </div>
  );

  if (!isAdmin) {
    return (
      <>
        {realtimeReady && isMember && (
          <RealtimeSubscription
            teamId={teamId}
            updateTeamCache={updateTeamCache}
            lastRemovalRef={lastRemovalRef}
          />
        )}
        {mainContent}
      </>
    );
  }

  return (
    <DndWrapper
      members={members}
      groups={groups}
      teamId={teamId}
      hasClaimedProfile={hasClaimedProfile}
      onDragEnd={handleDragEnd}
      onDragTypeChange={handleDragTypeChange}
    >
      {realtimeReady && isMember && (
        <RealtimeSubscription
          teamId={teamId}
          updateTeamCache={updateTeamCache}
          lastRemovalRef={lastRemovalRef}
        />
      )}
      {mainContent}
    </DndWrapper>
  );
};

type RealtimeSubscriptionProps = {
  lastRemovalRef: React.RefObject<{ id: string; ts: number }>;
  teamId: string;
  updateTeamCache: ReturnType<typeof useUpdateTeamCache>;
};

const RealtimeSubscription = ({
  teamId,
  updateTeamCache,
  lastRemovalRef,
}: RealtimeSubscriptionProps) => {
  useRealtime({
    channels: [`team-${teamId}`],
    events: [
      "team.memberAdded",
      "team.memberRemoved",
      "team.memberUpdated",
      "team.membersImported",
      "team.membersReordered",
      "team.nameUpdated",
      "team.groupCreated",
      "team.groupUpdated",
      "team.groupRemoved",
      "team.groupsReordered",
    ],
    onData({ event, data }) {
      if (event === "team.memberAdded") {
        const newMember = data as TeamMember;
        updateTeamCache(teamId, (prev) => {
          if (!prev) {
            return prev;
          }
          if (prev.team.members.some((m) => m.id === newMember.id)) {
            return prev;
          }
          return {
            ...prev,
            team: {
              ...prev.team,
              members: [...prev.team.members, newMember],
            },
          };
        });
        toast.success(`${newMember.name} joined the team`, {
          id: `member-added-${newMember.id}`,
        });
      } else if (event === "team.memberRemoved") {
        const { memberId } = data as { memberId: string };
        if (
          lastRemovalRef.current.id === memberId &&
          Date.now() - lastRemovalRef.current.ts < 1500
        ) {
          return;
        }
        updateTeamCache(teamId, (prev) => {
          if (!prev) {
            return prev;
          }
          const member = prev.team.members.find((m) => m.id === memberId);
          if (member) {
            lastRemovalRef.current = { id: memberId, ts: Date.now() };
            toast.success(`${member.name} left the team`, {
              id: `member-removed-${memberId}`,
            });
          }
          return {
            ...prev,
            team: {
              ...prev.team,
              members: prev.team.members.filter((m) => m.id !== memberId),
            },
          };
        });
      } else if (event === "team.memberUpdated") {
        const updatedMember = data as TeamMember;
        updateTeamCache(teamId, (prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            team: {
              ...prev.team,
              members: prev.team.members.map((m) =>
                m.id === updatedMember.id ? updatedMember : m,
              ),
            },
          };
        });
      } else if (event === "team.membersImported") {
        const newMembers = data as Array<TeamMember>;
        updateTeamCache(teamId, (prev) => {
          if (!prev) {
            return prev;
          }
          const existingIds = new Set(prev.team.members.map((m) => m.id));
          const toAdd = newMembers.filter((m) => !existingIds.has(m.id));
          if (toAdd.length === 0) {
            return prev;
          }
          return {
            ...prev,
            team: {
              ...prev.team,
              members: [...prev.team.members, ...toAdd],
            },
          };
        });
      } else if (event === "team.membersReordered") {
        const { order } = data as { order: Array<string> };
        updateTeamCache(teamId, (prev) => {
          if (!prev) {
            return prev;
          }
          const map = new Map(prev.team.members.map((m) => [m.id, m]));
          return {
            ...prev,
            team: {
              ...prev.team,
              members: order
                .map((id, index) => {
                  const member = map.get(id);
                  return member ? { ...member, order: index } : null;
                })
                .filter(Boolean) as Array<TeamMember>,
            },
          };
        });
      } else if (event === "team.nameUpdated") {
        const { name } = data as { name: string };
        updateTeamCache(teamId, (prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            team: { ...prev.team, name },
          };
        });
      } else if (event === "team.groupCreated") {
        const newGroup = data as TeamGroup;
        updateTeamCache(teamId, (prev) => {
          if (!prev) {
            return prev;
          }
          if (prev.team.groups.some((g) => g.id === newGroup.id)) {
            return prev;
          }
          return {
            ...prev,
            team: {
              ...prev.team,
              groups: [...prev.team.groups, newGroup],
            },
          };
        });
      } else if (event === "team.groupUpdated") {
        const updatedGroup = data as TeamGroup;
        updateTeamCache(teamId, (prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            team: {
              ...prev.team,
              groups: prev.team.groups.map((g) => (g.id === updatedGroup.id ? updatedGroup : g)),
            },
          };
        });
      } else if (event === "team.groupRemoved") {
        const { groupId } = data as { groupId: string };
        updateTeamCache(teamId, (prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            team: {
              ...prev.team,
              groups: prev.team.groups.filter((g) => g.id !== groupId),
              members: prev.team.members.map((m) =>
                m.groupId === groupId ? { ...m, groupId: undefined } : m,
              ),
            },
          };
        });
      } else if (event === "team.groupsReordered") {
        const { order } = data as { order: Array<string> };
        updateTeamCache(teamId, (prev) => {
          if (!prev) {
            return prev;
          }
          const map = new Map(prev.team.groups.map((g) => [g.id, g]));
          return {
            ...prev,
            team: {
              ...prev.team,
              groups: order
                .map((id, index) => {
                  const group = map.get(id);
                  return group ? { ...group, order: index } : null;
                })
                .filter(Boolean) as Array<TeamGroup>,
            },
          };
        });
      }
    },
  });

  return null;
};

export { TeamPageClient };
