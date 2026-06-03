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
    if (!stored) {
      return new Set();
    }
    try {
      return new Set(JSON.parse(stored) as Array<string>);
    } catch {
      // Silently reset — corrupt storage shouldn't break the UI
      return new Set();
    }
  });

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        const collapsedAfter = new Set([...prev, groupId]);
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
      try {
        localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...next]));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  };

  return {
    collapsedGroupIds: [...collapsedGroups],
    toggleGroupCollapse,
  };
};

export { useCollapsedGroups };
