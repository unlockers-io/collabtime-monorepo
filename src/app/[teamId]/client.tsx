"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Check,
  Clock,
  Copy,
  FolderKanban,
  Globe,
  Pencil,
  Users,
} from "lucide-react";
import type { Team, TeamGroup, TeamMember } from "@/types";
import { AddGroupDialog } from "@/components/add-group-dialog";
import { AddMemberDialog } from "@/components/add-member-dialog";
import { CurrentTimeDisplay } from "@/components/current-time-display";
import { GroupHeader } from "@/components/group-header";
import { MemberCard } from "@/components/member-card";
import { ModeToggle } from "@/components/mode-toggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TeamInsights } from "@/components/team-insights";
import { TimezoneVisualizer } from "@/components/timezone-visualizer";
import { useVisitedTeams } from "@/hooks/use-visited-teams";
import { useRealtime } from "@/lib/realtime-client";
import { updateTeamName as updateTeamNameAction } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { DragProvider } from "@/contexts/drag-context";
import {
  isCurrentlyWorking,
  getMinutesUntilAvailable,
} from "@/lib/timezones";

type TeamPageClientProps = {
  team: Team;
};

const COLLAPSED_GROUPS_KEY = "collab-time-collapsed-groups";

const TeamPageClient = ({ team }: TeamPageClientProps) => {
  const [members, setMembers] = useState<TeamMember[]>(team.members);
  const [groups, setGroups] = useState<TeamGroup[]>(team.groups ?? []);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Load collapsed groups from localStorage after hydration
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_GROUPS_KEY);
    if (stored) {
      setCollapsedGroups(new Set(JSON.parse(stored)));
    }
  }, []);
  const [, startTransition] = useTransition();
  const [hasCopied, setHasCopied] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const { saveVisitedTeam } = useVisitedTeams();
  const [teamName, setTeamName] = useState(team.name);
  const lastRemovalRef = useRef<{ id: string; ts: number }>({ id: "", ts: 0 });
  const previousNameRef = useRef(team.name);

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

  // Subscribe to realtime events for this team
  useRealtime({
    channels: [`team-${team.id}`],
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
        setMembers((prev) => {
          // Avoid duplicates (in case the current user added the member)
          if (prev.some((m) => m.id === newMember.id)) {
            return prev;
          }
          return [...prev, newMember];
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

        setMembers((prev) => {
          const member = prev.find((m) => m.id === memberId);
          if (member) {
            lastRemovalRef.current = { id: memberId, ts: Date.now() };
            toast.success(`${member.name} left the team`, {
              id: `member-removed-${memberId}`,
            });
          }
          return prev.filter((m) => m.id !== memberId);
        });
      } else if (event === "team.memberUpdated") {
        const updatedMember = data as TeamMember;
        setMembers((prev) =>
          prev.map((m) => (m.id === updatedMember.id ? updatedMember : m))
        );
      } else if (event === "team.membersReordered") {
        const { order } = data as { order: string[] };
        setMembers((prev) => {
          const map = new Map(prev.map((m) => [m.id, m]));
          return order.map((id) => map.get(id)).filter(Boolean) as TeamMember[];
        });
      } else if (event === "team.nameUpdated") {
        const { name } = data as { name: string };
        setTeamName(name);
      } else if (event === "team.groupCreated") {
        const newGroup = data as TeamGroup;
        setGroups((prev) => {
          if (prev.some((g) => g.id === newGroup.id)) {
            return prev;
          }
          return [...prev, newGroup];
        });
      } else if (event === "team.groupUpdated") {
        const updatedGroup = data as TeamGroup;
        setGroups((prev) =>
          prev.map((g) => (g.id === updatedGroup.id ? updatedGroup : g))
        );
      } else if (event === "team.groupRemoved") {
        const { groupId } = data as { groupId: string };
        setGroups((prev) => prev.filter((g) => g.id !== groupId));
        // Unassign members from the removed group
        setMembers((prev) =>
          prev.map((m) => (m.groupId === groupId ? { ...m, groupId: undefined } : m))
        );
      } else if (event === "team.groupsReordered") {
        const { order } = data as { order: string[] };
        setGroups((prev) => {
          const map = new Map(prev.map((g) => [g.id, g]));
          return order
            .map((id, index) => {
              const group = map.get(id);
              return group ? { ...group, order: index } : null;
            })
            .filter(Boolean) as TeamGroup[];
        });
      }
    },
  });

  // Save team to visited teams on mount and when members/name change
  useEffect(() => {
    saveVisitedTeam(team.id, members.length, teamName);
  }, [team.id, members.length, teamName, saveVisitedTeam]);

  // Re-fetch team data when tab regains focus to ensure sync
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        try {
          const response = await fetch(`/api/team/${team.id}`);
          if (response.ok) {
            const freshTeam = (await response.json()) as Team;
            setMembers(freshTeam.members);
            setGroups(freshTeam.groups ?? []);
            setTeamName(freshTeam.name);
            previousNameRef.current = freshTeam.name;
          }
        } catch {
          // Silently fail - realtime should catch up
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [team.id]);

  const handleSaveName = () => {
    const trimmedName = teamName.trim();
    setIsEditingName(false);

    if (trimmedName === previousNameRef.current) {
      return;
    }

    previousNameRef.current = trimmedName;
    startTransition(async () => {
      const result = await updateTeamNameAction(team.id, trimmedName);
      if (!result.success) {
        toast.error(result.error);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      setTeamName(previousNameRef.current);
      setIsEditingName(false);
    }
  };

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
  const handleMemberAdded = useCallback((newMember: TeamMember) => {
    setMembers((prev) => {
      if (prev.some((m) => m.id === newMember.id)) {
        return prev;
      }
      return [...prev, newMember];
    });
  }, []);

  const handleMemberRemoved = useCallback((memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  }, []);

  const handleMemberUpdated = useCallback((updatedMember: TeamMember) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === updatedMember.id ? updatedMember : m))
    );
  }, []);

  const handleGroupAdded = useCallback((newGroup: TeamGroup) => {
    setGroups((prev) => {
      if (prev.some((g) => g.id === newGroup.id)) {
        return prev;
      }
      return [...prev, newGroup];
    });
  }, []);

  const handleGroupUpdated = useCallback((updatedGroup: TeamGroup) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === updatedGroup.id ? updatedGroup : g))
    );
  }, []);

  const handleGroupRemoved = useCallback((groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    // Unassign members from the removed group
    setMembers((prev) =>
      prev.map((m) => (m.groupId === groupId ? { ...m, groupId: undefined } : m))
    );
  }, []);

  const handleMemberDroppedOnGroup = useCallback(
    async (memberId: string, groupId: string) => {
      const member = members.find((m) => m.id === memberId);
      if (!member) return;

      // Skip if already in this group
      if (member.groupId === groupId) return;

      // Optimistic update
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, groupId } : m))
      );

      // Import dynamically to avoid issues
      const { updateMember } = await import("@/lib/actions");
      const result = await updateMember(team.id, memberId, { groupId });

      if (result.success) {
        const group = groups.find((g) => g.id === groupId);
        toast.success(`${member.name} added to ${group?.name ?? "group"}`);
      } else {
        // Revert on failure
        setMembers((prev) =>
          prev.map((m) =>
            m.id === memberId ? { ...m, groupId: member.groupId } : m
          )
        );
        toast.error(result.error);
      }
    },
    [members, groups, team.id]
  );

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setHasCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

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
        <header className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 transition-opacity hover:opacity-80 dark:bg-neutral-100"
                aria-label="Go to homepage"
              >
                <Globe className="h-5 w-5 text-white dark:text-neutral-900" />
              </Link>
              {isEditingName ? (
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  placeholder="Team name…"
                  className="h-9 w-full max-w-48 rounded-lg border border-neutral-200 bg-white px-3 text-base font-bold tracking-tight text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-400 dark:focus:ring-neutral-400/20 sm:text-lg"
                />
              ) : (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="group flex min-w-0 items-center gap-2"
                >
                  <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{teamName || "Team Workspace"}</h1>
                  <Pencil
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 text-neutral-400 transition-opacity",
                      teamName
                        ? "opacity-0 group-hover:opacity-100"
                        : "opacity-100"
                    )}
                  />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <CurrentTimeDisplay />
              <button
                onClick={handleCopyLink}
                className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 shadow-sm transition-all hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 dark:focus-visible:ring-neutral-100 dark:focus-visible:ring-offset-neutral-950 sm:px-4"
              >
                <AnimatePresence mode="wait">
                  {hasCopied ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-green-700 dark:text-green-400"
                    >
                      <Check className="h-4 w-4" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="copy"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Copy className="h-4 w-4" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <span className="hidden sm:inline">{hasCopied ? "Copied!" : "Copy Link"}</span>
              </button>
              <ModeToggle />
            </div>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Share this page with your team to collaborate across timezones
          </p>
        </header>

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

            {members.length > 0 && (
              <ScrollArea className="max-h-[600px]">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 pr-4">
                  {orderedMembers.map((member) => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      teamId={team.id}
                      groups={groups}
                      onMemberRemoved={handleMemberRemoved}
                      onMemberUpdated={handleMemberUpdated}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}

            <AddMemberDialog
              teamId={team.id}
              groups={groups}
              onMemberAdded={handleMemberAdded}
              isFirstMember={members.length === 0}
            />
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
                        teamId={team.id}
                        memberCount={members.filter((m) => m.groupId === group.id).length}
                        onGroupUpdated={handleGroupUpdated}
                        onGroupRemoved={handleGroupRemoved}
                        onMemberDropped={handleMemberDroppedOnGroup}
                      />
                    ))}
                </div>
              </ScrollArea>
            )}

            <AddGroupDialog teamId={team.id} onGroupAdded={handleGroupAdded} />
          </section>
        </motion.div>
        </motion.main>
      </div>
    </DragProvider>
  );
};

export { TeamPageClient };
