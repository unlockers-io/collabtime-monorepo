"use client";

import { useState } from "react";

import type { TeamMember } from "@/types";

const COLLAPSED_GROUPS_KEY = "collabtime-collapsed-groups";

const useCollapsedGroups = (members: Array<TeamMember>) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    if (typeof window === "undefined") {
      return new Set();
    }
    const stored = localStorage.getItem(COLLAPSED_GROUPS_KEY);
    if (stored === null || stored === "") {
      return new Set();
    }
    try {
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return new Set();
      }
      return new Set(parsed.filter((id): id is string => typeof id === "string"));
    } catch {
      // Silently reset: corrupt storage shouldn't break the UI
      return new Set();
    }
  });

  // Computed outside the updater: updaters must be pure; StrictMode may invoke them twice.
  const toggleGroupCollapse = (groupId: string) => {
    const next = new Set(collapsedGroups);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      const collapsedAfter = new Set([...collapsedGroups, groupId]);
      const ungroupedCount = members.filter(
        (m) => m.groupId === undefined || m.groupId === "",
      ).length;
      const visibleGroupedCount = members.filter((m) => {
        if (m.groupId === undefined || m.groupId === "") {
          return false;
        }
        return !collapsedAfter.has(m.groupId);
      }).length;
      const totalVisibleAfter = ungroupedCount + visibleGroupedCount;
      if (totalVisibleAfter > 0) {
        next.add(groupId);
      }
    }
    setCollapsedGroups(next);
    try {
      localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...next]));
    } catch {
      // ignore quota errors
    }
  };

  return {
    collapsedGroupIds: [...collapsedGroups],
    toggleGroupCollapse,
  };
};

export { useCollapsedGroups };
