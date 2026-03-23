"use client";

import { Button, ScrollArea, Spinner } from "@repo/ui";
import { Clock, FolderKanban, LogIn, UserPlus, Users } from "lucide-react";
import { motion } from "motion/react";
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
import { TeamInsights } from "@/components/team-insights";
import { TimezoneVisualizer } from "@/components/timezone-visualizer";
import { DragProvider } from "@/contexts/drag-context";
import { useTeamQuery, useUpdateTeamCache } from "@/hooks/use-team-query";
import { updateTeamName, updateMember, requestToJoin } from "@/lib/actions";
import { useRealtime } from "@/lib/realtime-client";
import { isCurrentlyWorking, getMinutesUntilAvailable } from "@/lib/timezones";
import type { TeamGroup, TeamMember } from "@/types";

import Loading from "./loading";

type TeamStatus = "admin" | "member" | "pending" | "none";

type TeamPageClientProps = {
  isAuthenticated: boolean;
  teamId: string;
  teamStatus: TeamStatus;
};

const COLLAPSED_GROUPS_KEY = "collabtime-collapsed-groups";

const TeamPageClient = ({
  teamId,
  isAuthenticated,
  teamStatus: initialStatus,
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
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingTeamName, setEditingTeamName] = useState("");
  const [isRequestingJoin, setIsRequestingJoin] = useState(false);
  const lastRemovalRef = useRef<{ id: string; ts: number }>({ id: "", ts: 0 });

  const isAdmin = teamStatus === "admin";
  const isMember = teamStatus === "admin" || teamStatus === "member";

  // Fetch team data with TanStack Query
  const { data: teamData, error: teamError } = useTeamQuery({ teamId });

  const updateTeamCache = useUpdateTeamCache();

  useEffect(() => {
    if (teamError) {
      toast.error(teamError.message);
    }
  }, [teamError]);

  const members = useMemo(() => teamData?.team?.members ?? [], [teamData?.team?.members]);
  const groups = useMemo(() => teamData?.team?.groups ?? [], [teamData?.team?.groups]);

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

  // Subscribe to realtime events — all members can receive updates
  useRealtime({
    channels: isMember ? [`team-${teamId}`] : [],
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
              members: order.map((id) => map.get(id)).filter(Boolean) as Array<TeamMember>,
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
        setTeamStatus("pending");
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

  // Sort members: available first, then by time until available
  const orderedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const aIsAvailable = isCurrentlyWorking(a.timezone, a.workingHoursStart, a.workingHoursEnd);
      const bIsAvailable = isCurrentlyWorking(b.timezone, b.workingHoursStart, b.workingHoursEnd);

      if (aIsAvailable && !bIsAvailable) {
        return -1;
      }
      if (!aIsAvailable && bIsAvailable) {
        return 1;
      }

      if (!aIsAvailable && !bIsAvailable) {
        const aMinutes = getMinutesUntilAvailable(
          a.timezone,
          a.workingHoursStart,
          a.workingHoursEnd,
        );
        const bMinutes = getMinutesUntilAvailable(
          b.timezone,
          b.workingHoursStart,
          b.workingHoursEnd,
        );
        return aMinutes - bMinutes;
      }

      return 0;
    });
  }, [members]);

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

  if (!teamData?.team) {
    return <Loading />;
  }

  return (
    <DragProvider>
      <div className="min-h-screen w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto flex w-full max-w-450 flex-col gap-6"
        >
          {/* Header */}
          <Nav
            variant="team"
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
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <TeamInsights members={orderedMembers} groups={groups} />
            </motion.section>
          )}

          {/* Timezone Visualizer */}
          {members.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
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
            </motion.section>
          )}

          {/* Team Members & Groups */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 gap-6 xl:grid-cols-2"
          >
            {/* Team Members */}
            <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  Team Members
                </h2>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                  {members.length}
                </span>
              </div>

              {members.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border bg-muted/50 px-6 py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="font-semibold text-foreground">Build your team</h3>
                    <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                      Add team members to see their working hours and find the best times to
                      collaborate across timezones.
                    </p>
                  </div>
                </div>
              ) : (
                <ScrollArea className="max-h-150">
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 pr-4">
                    {orderedMembers.map((member) => (
                      <MemberCard
                        key={member.id}
                        member={member}
                        teamId={teamId}
                        groups={groups}
                        canEdit={isAdmin}
                        onMemberRemoved={handleMemberRemoved}
                        onMemberUpdated={handleMemberUpdated}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}

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
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/login?redirect=/${teamId}`}>
                          <LogIn className="mr-2 h-4 w-4" />
                          Sign in
                        </Link>
                      </Button>
                    </>
                  ) : teamStatus === "pending" ? (
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
            <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <FolderKanban className="h-5 w-5 text-muted-foreground" />
                  Groups
                </h2>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                  {groups.length}
                </span>
              </div>

              {groups.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border bg-muted/50 px-6 py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                    <FolderKanban className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="font-semibold text-foreground">Organize with groups</h3>
                    <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                      Create groups to organize team members by department, project, or location.
                      Drag and drop members into groups to categorize them.
                    </p>
                  </div>
                </div>
              ) : (
                <ScrollArea className="max-h-150">
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 pr-4">
                    {[...groups]
                      .sort((a, b) => a.order - b.order)
                      .map((group) => (
                        <GroupCard
                          key={group.id}
                          group={group}
                          teamId={teamId}
                          memberCount={members.filter((m) => m.groupId === group.id).length}
                          canEdit={isAdmin}
                          onGroupUpdated={handleGroupUpdated}
                          onGroupRemoved={handleGroupRemoved}
                          onMemberDropped={isAdmin ? handleMemberDroppedOnGroup : undefined}
                        />
                      ))}
                  </div>
                </ScrollArea>
              )}

              {isAdmin && <AddGroupDialog teamId={teamId} onGroupAdded={handleGroupAdded} />}
            </section>
          </motion.div>
        </motion.main>
      </div>
    </DragProvider>
  );
};

export { TeamPageClient };
