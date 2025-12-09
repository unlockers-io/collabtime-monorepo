"use client";

import { AnimatePresence, motion, Reorder } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Team, TeamMember } from "@/types";
import { AddMemberForm } from "@/components/add-member-form";
import { MemberCard } from "@/components/member-card";
import { TimezoneVisualizer } from "@/components/timezone-visualizer";

type TeamPageClientProps = {
  team: Team;
};

const getStorageKey = (teamId: string) => `collab-time-order-${teamId}`;

const getInitialOrder = (teamId: string): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(getStorageKey(teamId));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore localStorage errors
  }
  return [];
};

const TeamPageClient = ({ team }: TeamPageClientProps) => {
  const router = useRouter();
  const [memberOrder, setMemberOrder] = useState<string[]>(() =>
    getInitialOrder(team.id)
  );
  const [hasCopied, setHasCopied] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Sort members based on stored order
  const orderedMembers = useMemo(() => {
    if (memberOrder.length === 0) {
      return team.members;
    }

    const orderMap = new Map(memberOrder.map((id, index) => [id, index]));
    return [...team.members].sort((a, b) => {
      const orderA = orderMap.get(a.id) ?? Infinity;
      const orderB = orderMap.get(b.id) ?? Infinity;
      return orderA - orderB;
    });
  }, [team.members, memberOrder]);

  const handleReorder = (newOrder: TeamMember[]) => {
    const newOrderIds = newOrder.map((m) => m.id);
    setMemberOrder(newOrderIds);

    // Debounce localStorage writes
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          getStorageKey(team.id),
          JSON.stringify(newOrderIds)
        );
      } catch {
        // Ignore localStorage errors (quota exceeded, etc.)
      }
    }, 300);
  };

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

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
    <div className="flex min-h-screen items-start justify-center bg-neutral-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-8 sm:py-12">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              Team Workspace
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Share this page with your team to collaborate across timezones
            </p>
          </div>
          <button
            onClick={handleCopyLink}
            className="flex h-10 items-center justify-center gap-2 rounded-md border border-neutral-300 px-4 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <AnimatePresence mode="wait">
              {hasCopied ? (
                <motion.div
                  key="check"
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
            Copy Link
          </button>
        </div>

        {/* Timezone Visualizer */}
        {team.members.length > 0 && (
          <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <TimezoneVisualizer members={orderedMembers} />
          </div>
        )}

        {/* Team Members */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Team Members ({team.members.length})
          </h2>

          {team.members.length === 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-neutral-500 dark:text-neutral-400">
                No team members yet. Add yourself to get started!
              </p>
            </div>
          ) : team.members.length === 1 ? (
            <div className="flex flex-col gap-2">
              <MemberCard
                member={team.members[0]}
                teamId={team.id}
                onMemberRemoved={handleRefresh}
                onMemberUpdated={handleRefresh}
              />
            </div>
          ) : (
            <Reorder.Group
              as="div"
              axis="y"
              values={orderedMembers}
              onReorder={handleReorder}
              className="flex flex-col gap-2"
            >
              {orderedMembers.map((member) => (
                <Reorder.Item
                  as="div"
                  key={member.id}
                  value={member}
                  className="cursor-grab active:cursor-grabbing"
                  whileDrag={{
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  }}
                >
                  <MemberCard
                    member={member}
                    teamId={team.id}
                    onMemberRemoved={handleRefresh}
                    onMemberUpdated={handleRefresh}
                  />
                </Reorder.Item>
              ))}
            </Reorder.Group>
          )}

          <AddMemberForm
            teamId={team.id}
            onMemberAdded={handleRefresh}
            isFirstMember={team.members.length === 0}
          />
        </div>
      </main>
    </div>
  );
};

export { TeamPageClient };
