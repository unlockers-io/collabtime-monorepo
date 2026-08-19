"use client";

import { useState } from "react";
import { z } from "zod";

import type { TeamMember } from "@/types";

const COLLAPSED_GROUPS_KEY = "collabtime-collapsed-groups:v1";
const collapsedGroupsSchema = z.array(z.string());

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
      const parsed = collapsedGroupsSchema.safeParse(JSON.parse(stored));
      if (!parsed.success) {
        return new Set();
      }
      return new Set(parsed.data);
    } catch {
      return new Set();
    }
  });

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
