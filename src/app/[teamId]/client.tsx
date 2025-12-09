"use client";

import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { Team, TeamMember } from "@/types";
import { AddMemberForm } from "@/components/add-member-form";
import { MemberCard } from "@/components/member-card";
import { TimezoneVisualizer } from "@/components/timezone-visualizer";
import { useVisitedTeams } from "@/hooks/use-visited-teams";
import { useRealtime } from "@/lib/realtime-client";
import {
  reorderMembers as reorderMembersAction,
  updateTeamName as updateTeamNameAction,
} from "@/lib/actions";
import { cn } from "@/lib/utils";

type TeamPageClientProps = {
  team: Team;
};

type ReorderableCardProps = {
  member: TeamMember;
  teamId: string;
  onMemberRemoved: (memberId: string) => void;
  onMemberUpdated: (member: TeamMember) => void;
};

const ReorderableCard = ({
  member,
  teamId,
  onMemberRemoved,
  onMemberUpdated,
}: ReorderableCardProps) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      as="div"
      value={member}
      layout="position"
      dragListener={false}
      dragControls={dragControls}
      className="group/reorder relative select-none"
      whileDrag={{
        boxShadow:
          "0 10px 40px -10px rgba(0,0,0,0.2), 0 4px 12px -4px rgba(0,0,0,0.15)",
        zIndex: 50,
      }}
    >
      {/* Mobile drag handle */}
      <button
        type="button"
        className="absolute -top-2 left-2 flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-lg bg-neutral-100 text-neutral-400 shadow-sm active:cursor-grabbing dark:bg-neutral-800 dark:text-neutral-500 sm:hidden"
        onPointerDown={(e) => dragControls.start(e)}
        aria-label="Drag to reorder"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="5" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="19" r="1" />
          <circle cx="15" cy="5" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="19" r="1" />
        </svg>
      </button>
      {/* Desktop: entire card is draggable */}
      <div
        className="hidden cursor-grab active:cursor-grabbing sm:block"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <MemberCard
          member={member}
          teamId={teamId}
          onMemberRemoved={onMemberRemoved}
          onMemberUpdated={onMemberUpdated}
        />
      </div>
      {/* Mobile: card is not draggable, only handle is */}
      <div className="sm:hidden">
        <MemberCard
          member={member}
          teamId={teamId}
          onMemberRemoved={onMemberRemoved}
          onMemberUpdated={onMemberUpdated}
        />
      </div>
    </Reorder.Item>
  );
};

const TeamPageClient = ({ team }: TeamPageClientProps) => {
  const [members, setMembers] = useState<TeamMember[]>(team.members);
  const [, startTransition] = useTransition();
  const [hasCopied, setHasCopied] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const { saveVisitedTeam } = useVisitedTeams();
  const [teamName, setTeamName] = useState(team.name);
  const lastRemovalRef = useRef<{ id: string; ts: number }>({ id: "", ts: 0 });
  const reorderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousOrderRef = useRef<TeamMember[]>(team.members);
  const previousNameRef = useRef(team.name);

  // Subscribe to realtime events for this team
  useRealtime({
    channels: [`team-${team.id}`],
    events: [
      "team.memberAdded",
      "team.memberRemoved",
      "team.memberUpdated",
      "team.membersReordered",
      "team.nameUpdated",
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
      }
    },
  });

  // Save team to visited teams on mount and when members/name change
  useEffect(() => {
    saveVisitedTeam(team.id, members.length, teamName);
  }, [team.id, members.length, teamName, saveVisitedTeam]);

  // Cleanup reorder timeout on unmount
  useEffect(() => {
    return () => {
      if (reorderTimeoutRef.current) {
        clearTimeout(reorderTimeoutRef.current);
      }
    };
  }, []);

  // Re-fetch team data when tab regains focus to ensure sync
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        try {
          const response = await fetch(`/api/team/${team.id}`);
          if (response.ok) {
            const freshTeam = (await response.json()) as Team;
            setMembers(freshTeam.members);
            setTeamName(freshTeam.name);
            previousOrderRef.current = freshTeam.members;
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

  // Members are already ordered from the server; derive array for UI
  const orderedMembers = useMemo(() => members, [members]);

  // Debounced reorder to prevent multiple server calls while dragging
  const handleReorder = useCallback((newOrder: TeamMember[]) => {
    // Update UI immediately
    setMembers(newOrder);

    // Clear any pending server update
    if (reorderTimeoutRef.current) {
      clearTimeout(reorderTimeoutRef.current);
    }

    // Debounce the server call
    reorderTimeoutRef.current = setTimeout(() => {
      const newOrderIds = newOrder.map((m) => m.id);
      const previous = previousOrderRef.current;
      previousOrderRef.current = newOrder;

      startTransition(async () => {
        const result = await reorderMembersAction(team.id, newOrderIds);
        if (!result.success) {
          toast.error(result.error);
          // revert on failure
          setMembers(previous);
          previousOrderRef.current = previous;
        }
      });
    }, 300);
  }, [team.id, startTransition]);

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
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex w-full max-w-4xl flex-col gap-8"
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white dark:text-neutral-900"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
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
                  className="group flex min-w-0 items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl"
                >
                  <span className="truncate">{teamName || "Team Workspace"}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cn(
                      "shrink-0 text-neutral-400 transition-opacity",
                      teamName
                        ? "opacity-0 group-hover:opacity-100"
                        : "opacity-100"
                    )}
                  >
                    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
                    <path d="m15 5 4 4" />
                  </svg>
                </button>
              )}
            </div>

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
                    className="text-green-600 dark:text-green-400"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                  </motion.div>
                )}
              </AnimatePresence>
              <span className="hidden sm:inline">{hasCopied ? "Copied!" : "Copy Link"}</span>
            </button>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Share this page with your team to collaborate across timezones
          </p>
        </header>

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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-500"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Working Hours Overview
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                Times shown in your local timezone
              </p>
            </div>
            <div className="p-4 sm:p-6">
              <TimezoneVisualizer members={orderedMembers} />
            </div>
          </motion.section>
        )}

        {/* Team Members */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-neutral-500"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Team Members
            </h2>
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium tabular-nums text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              {members.length}
            </span>
          </div>

          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 px-6 py-12 text-center dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-500"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" x2="19" y1="8" y2="14" />
                  <line x1="22" x2="16" y1="11" y2="11" />
                </svg>
              </div>
              <h3 className="mt-4 font-semibold text-neutral-900 dark:text-neutral-100">
                No team members yet
              </h3>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Add yourself to get started!
              </p>
            </div>
          ) : members.length === 1 ? (
            <div className="flex flex-col gap-3">
              <MemberCard
                member={members[0]}
                teamId={team.id}
                onMemberRemoved={handleMemberRemoved}
                onMemberUpdated={handleMemberUpdated}
              />
            </div>
          ) : (
            <Reorder.Group
              as="div"
              axis="y"
              values={orderedMembers}
              onReorder={handleReorder}
              className="flex flex-col gap-3"
            >
              {orderedMembers.map((member) => (
                <ReorderableCard
                  key={member.id}
                  member={member}
                  teamId={team.id}
                  onMemberRemoved={handleMemberRemoved}
                  onMemberUpdated={handleMemberUpdated}
                />
              ))}
            </Reorder.Group>
          )}

          <AddMemberForm
            teamId={team.id}
            onMemberAdded={handleMemberAdded}
            isFirstMember={team.members.length === 0}
          />
        </motion.section>
      </motion.main>
    </div>
  );
};

export { TeamPageClient };
