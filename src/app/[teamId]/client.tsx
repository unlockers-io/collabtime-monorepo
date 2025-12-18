"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Clock, FolderKanban, Users } from "lucide-react";
import type { TeamGroup, TeamMember } from "@/types";
import { AddGroupDialog } from "@/components/add-group-dialog";
import { AddMemberDialog } from "@/components/add-member-dialog";
import { GroupHeader } from "@/components/group-header";
import { MemberCard } from "@/components/member-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TeamNavbar } from "@/components/team-navbar";
import { Spinner } from "@/components/ui/spinner";
import { TeamInsights } from "@/components/team-insights";
import { TimezoneVisualizer } from "@/components/timezone-visualizer";
import { TeamAuthDialog } from "@/components/team-auth-dialog";
import { useTeamQuery, useUpdateTeamCache } from "@/hooks/use-team-query";
import { useVisitedTeams } from "@/hooks/use-visited-teams";
import { useRealtime } from "@/lib/realtime-client";
import { updateTeamName as updateTeamNameAction } from "@/lib/actions";
import { clearTeamSession, writeTeamSession } from "@/lib/team-session";
import { DragProvider } from "@/contexts/drag-context";
import {
  isCurrentlyWorking,
  getMinutesUntilAvailable,
} from "@/lib/timezones";

type TeamPageClientProps = {
  teamId: string;
  initialToken: string | null;
};

const COLLAPSED_GROUPS_KEY = "collab-time-collapsed-groups";

const TeamPageClient = ({ teamId, initialToken }: TeamPageClientProps) => {
  const [token, setToken] = useState<string | null>(initialToken);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Load collapsed groups from localStorage after hydration
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_GROUPS_KEY);
    if (stored) {
      setCollapsedGroups(new Set(JSON.parse(stored)));
    }
  }, []);
  const [, startTransition] = useTransition();
  const [isEditingName, setIsEditingName] = useState(false);
  const { saveVisitedTeam } = useVisitedTeams();
  const [teamName, setTeamName] = useState("");
  const lastRemovalRef = useRef<{ id: string; ts: number }>({ id: "", ts: 0 });
  const previousNameRef = useRef("");

  // Fetch team data with TanStack Query
  const { data: teamData, error: teamError } = useTeamQuery({
    teamId,
    token,
  });

  const updateTeamCache = useUpdateTeamCache();

  // Handle query error (e.g., session expired)
  useEffect(() => {
    if (teamError) {
      clearTeamSession(teamId).catch(() => {});
      setToken(null);
      setTeamName("");
      previousNameRef.current = "";
      toast.error(teamError.message);
    }
  }, [teamError, teamId]);

  // Derived values from query - memoized for stable references
  const team = teamData?.team ?? null;
  const members = useMemo(() => team?.members ?? [], [team?.members]);
  const groups = useMemo(() => team?.groups ?? [], [team?.groups]);

  // Sync team data to local state when query data changes
  useEffect(() => {
    if (team) {
      setTeamName(team.name);
      previousNameRef.current = team.name;
    }
  }, [team]);
  const isAdmin = teamData?.role === "admin";

  // Persist collapsed groups to localStorage
  useEffect(() => {
    localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...collapsedGroups]));
  }, [collapsedGroups]);

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        // Expanding - always allowed
        next.delete(groupId);
      } else {
        // Collapsing - check if this would leave at least one member visible
        // Calculate how many members would be visible after this collapse
        const collapsedAfter = new Set([...prev, groupId]);

        // Count visible members: ungrouped + members in non-collapsed groups
        const ungroupedCount = members.filter((m) => !m.groupId).length;
        const visibleGroupedCount = members.filter((m) => {
          if (!m.groupId) return false; // Ungrouped counted separately
          return !collapsedAfter.has(m.groupId);
        }).length;

        const totalVisibleAfter = ungroupedCount + visibleGroupedCount;

        // Only allow collapse if at least one member remains visible
        if (totalVisibleAfter > 0) {
          next.add(groupId);
        }
      }
      return next;
    });
  }, [members]);

  // Subscribe to realtime events for this team - updates TanStack Query cache
  useRealtime({
    channels: token ? [`team-${teamId}`] : [],
    events: [
      "team.memberAdded",
      "team.memberRemoved",
      "team.memberUpdated",
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
          if (!prev) return prev;
          // Avoid duplicates
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

        // Dedupe rapid double-deliveries of the same removal event
        if (
          lastRemovalRef.current.id === memberId &&
          Date.now() - lastRemovalRef.current.ts < 1500
        ) {
          return;
        }

        updateTeamCache(teamId, (prev) => {
          if (!prev) return prev;
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
          if (!prev) return prev;
          return {
            ...prev,
            team: {
              ...prev.team,
              members: prev.team.members.map((m) =>
                m.id === updatedMember.id ? updatedMember : m
              ),
            },
          };
        });
      } else if (event === "team.membersReordered") {
        const { order } = data as { order: string[] };
        updateTeamCache(teamId, (prev) => {
          if (!prev) return prev;
          const map = new Map(prev.team.members.map((m) => [m.id, m]));
          return {
            ...prev,
            team: {
              ...prev.team,
              members: order.map((id) => map.get(id)).filter(Boolean) as TeamMember[],
            },
          };
        });
      } else if (event === "team.nameUpdated") {
        const { name } = data as { name: string };
        updateTeamCache(teamId, (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            team: { ...prev.team, name },
          };
        });
        setTeamName(name);
        previousNameRef.current = name;
      } else if (event === "team.groupCreated") {
        const newGroup = data as TeamGroup;
        updateTeamCache(teamId, (prev) => {
          if (!prev) return prev;
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
          if (!prev) return prev;
          return {
            ...prev,
            team: {
              ...prev.team,
              groups: prev.team.groups.map((g) =>
                g.id === updatedGroup.id ? updatedGroup : g
              ),
            },
          };
        });
      } else if (event === "team.groupRemoved") {
        const { groupId } = data as { groupId: string };
        updateTeamCache(teamId, (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            team: {
              ...prev.team,
              groups: prev.team.groups.filter((g) => g.id !== groupId),
              members: prev.team.members.map((m) =>
                m.groupId === groupId ? { ...m, groupId: undefined } : m
              ),
            },
          };
        });
      } else if (event === "team.groupsReordered") {
        const { order } = data as { order: string[] };
        updateTeamCache(teamId, (prev) => {
          if (!prev) return prev;
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
                .filter(Boolean) as TeamGroup[],
            },
          };
        });
      }
    },
  });

  // Save team to visited teams on mount and when members/name change
  useEffect(() => {
    if (!team) return;
    saveVisitedTeam(teamId, members.length, teamName);
  }, [team, teamId, members.length, teamName, saveVisitedTeam]);

  const handleSaveName = () => {
    if (!isAdmin || !token) return;

    const trimmedName = teamName.trim();
    setIsEditingName(false);

    if (trimmedName === previousNameRef.current) {
      return;
    }

    previousNameRef.current = trimmedName;
    startTransition(async () => {
      const result = await updateTeamNameAction(teamId, token, trimmedName);
      if (!result.success) {
        toast.error(result.error);
      }
    });
  };

  const handleCancelEditName = useCallback(() => {
    setTeamName(previousNameRef.current);
    setIsEditingName(false);
  }, []);

  const handleLogout = useCallback(() => {
    setToken(null);
    setTeamName("");
    previousNameRef.current = "";
  }, []);

  // Sort members: available first, then by time until available
  const orderedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const aIsAvailable = isCurrentlyWorking(
        a.timezone,
        a.workingHoursStart,
        a.workingHoursEnd
      );
      const bIsAvailable = isCurrentlyWorking(
        b.timezone,
        b.workingHoursStart,
        b.workingHoursEnd
      );

      // Available members come first
      if (aIsAvailable && !bIsAvailable) return -1;
      if (!aIsAvailable && bIsAvailable) return 1;

      // If both unavailable, sort by time until available
      if (!aIsAvailable && !bIsAvailable) {
        const aMinutes = getMinutesUntilAvailable(
          a.timezone,
          a.workingHoursStart,
          a.workingHoursEnd
        );
        const bMinutes = getMinutesUntilAvailable(
          b.timezone,
          b.workingHoursStart,
          b.workingHoursEnd
        );
        return aMinutes - bMinutes;
      }

      // If both available, keep original order
      return 0;
    });
  }, [members]);

  // Convert Set to array for stable prop reference
  const collapsedGroupIds = useMemo(() => [...collapsedGroups], [collapsedGroups]);

  // Callbacks for local state updates (realtime handles cross-user sync)
  const handleMemberAdded = useCallback(
    (newMember: TeamMember) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) return prev;
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
    [teamId, updateTeamCache]
  );

  const handleMemberRemoved = useCallback(
    (memberId: string) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          team: {
            ...prev.team,
            members: prev.team.members.filter((m) => m.id !== memberId),
          },
        };
      });
    },
    [teamId, updateTeamCache]
  );

  const handleMemberUpdated = useCallback(
    (updatedMember: TeamMember) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          team: {
            ...prev.team,
            members: prev.team.members.map((m) =>
              m.id === updatedMember.id ? updatedMember : m
            ),
          },
        };
      });
    },
    [teamId, updateTeamCache]
  );

  const handleGroupAdded = useCallback(
    (newGroup: TeamGroup) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) return prev;
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
    [teamId, updateTeamCache]
  );

  const handleGroupUpdated = useCallback(
    (updatedGroup: TeamGroup) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          team: {
            ...prev.team,
            groups: prev.team.groups.map((g) =>
              g.id === updatedGroup.id ? updatedGroup : g
            ),
          },
        };
      });
    },
    [teamId, updateTeamCache]
  );

  const handleGroupRemoved = useCallback(
    (groupId: string) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          team: {
            ...prev.team,
            groups: prev.team.groups.filter((g) => g.id !== groupId),
            // Unassign members from the removed group
            members: prev.team.members.map((m) =>
              m.groupId === groupId ? { ...m, groupId: undefined } : m
            ),
          },
        };
      });
    },
    [teamId, updateTeamCache]
  );

  const handleMemberDroppedOnGroup = useCallback(
    async (memberId: string, groupId: string) => {
      if (!isAdmin || !token) {
        toast.error("Admin access required");
        return;
      }

      const member = members.find((m) => m.id === memberId);
      if (!member) return;

      // Skip if already in this group
      if (member.groupId === groupId) return;

      const previousGroupId = member.groupId;

      // Optimistic update
      updateTeamCache(teamId, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          team: {
            ...prev.team,
            members: prev.team.members.map((m) =>
              m.id === memberId ? { ...m, groupId } : m
            ),
          },
        };
      });

      // Import dynamically to avoid issues
      const { updateMember } = await import("@/lib/actions");
      const result = await updateMember(teamId, token, memberId, { groupId });

      if (result.success) {
        const group = groups.find((g) => g.id === groupId);
        toast.success(`${member.name} added to ${group?.name ?? "group"}`);
      } else {
        // Revert on failure
        updateTeamCache(teamId, (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            team: {
              ...prev.team,
              members: prev.team.members.map((m) =>
                m.id === memberId ? { ...m, groupId: previousGroupId } : m
              ),
            },
          };
        });
        toast.error(result.error);
      }
    },
    [isAdmin, members, groups, teamId, token, updateTeamCache]
  );

  const handleAuthenticated = useCallback(
    async (data: { token: string; role: "admin" | "member" }) => {
      setToken(data.token);
      await writeTeamSession(teamId, data.token);

      toast.success(
        data.role === "admin" ? "Admin access granted" : "Member access granted"
      );
    },
    [teamId]
  );

  if (!token) {
    return (
      <TeamAuthDialog open teamId={teamId} onAuthenticated={handleAuthenticated} />
    );
  }

  if (!team) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  return (
    <DragProvider>
      <div className="min-h-screen w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
        <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex w-full max-w-[1800px] flex-col gap-6"
      >
        {/* Header */}
        <TeamNavbar
          teamId={teamId}
          teamName={teamName}
          isAdmin={isAdmin}
          isEditingName={isEditingName}
          token={token}
          onEditName={() => setIsEditingName(true)}
          onNameChange={setTeamName}
          onSaveName={handleSaveName}
          onCancelEdit={handleCancelEditName}
          onLogout={handleLogout}
        />

        {/* Team Insights */}
        {members.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <TeamInsights members={orderedMembers} groups={groups} />
          </motion.section>
        )}

        {/* Timezone Visualizer */}
        {members.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800 sm:px-6 sm:py-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                <Clock className="h-4 w-4 text-neutral-500" />
                Working Hours Overview
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                Times shown in your local timezone
              </p>
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

        {/* Team Members & Groups - Two column layout on large screens */}
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
                <Users className="h-5 w-5 text-neutral-500" />
                Team Members
              </h2>
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium tabular-nums text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                {members.length}
              </span>
            </div>

            {members.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 px-6 py-12 text-center dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <Users className="h-6 w-6 text-neutral-500" />
                </div>
                <h3 className="mt-4 font-semibold text-neutral-900 dark:text-neutral-100">
                  Build your team
                </h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
                  Add team members to see their working hours and find the best times to collaborate across timezones.
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 pr-4">
                  {orderedMembers.map((member) => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      teamId={teamId}
                      token={token}
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
              <AddMemberDialog
                teamId={teamId}
                token={token}
                groups={groups}
                onMemberAdded={handleMemberAdded}
                isFirstMember={members.length === 0}
              />
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                View-only access. Ask an admin for the admin password to make changes.
              </p>
            )}
          </section>

          {/* Groups */}
          <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <FolderKanban className="h-5 w-5 text-neutral-500" />
                Groups
              </h2>
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium tabular-nums text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                {groups.length}
              </span>
            </div>

            {groups.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 px-6 py-12 text-center dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <FolderKanban className="h-6 w-6 text-neutral-500" />
                </div>
                <h3 className="mt-4 font-semibold text-neutral-900 dark:text-neutral-100">
                  Organize with groups
                </h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
                  Create groups to organize team members by department, project, or location. Drag and drop members into groups to categorize them.
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 pr-4">
                  {[...groups]
                    .sort((a, b) => a.order - b.order)
                    .map((group) => (
                      <GroupHeader
                        key={group.id}
                        group={group}
                        teamId={teamId}
                        token={token}
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

            {isAdmin && (
              <AddGroupDialog
                teamId={teamId}
                token={token}
                onGroupAdded={handleGroupAdded}
              />
            )}
          </section>
        </motion.div>
        </motion.main>
      </div>
    </DragProvider>
  );
};

export { TeamPageClient };
