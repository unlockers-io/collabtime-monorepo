"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, Check, CheckCircle, ChevronRight, Clock, Minus, Plus, Users, X } from "lucide-react";
import type { TeamGroup, TeamMember } from "@/types";
import { convertHourToTimezone, getDayOffset, getUserTimezone } from "@/lib/timezones";
import { formatHour } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
  SelectLabel,
  SelectGroup,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type TimezoneVisualizerProps = {
  members: TeamMember[];
  groups?: TeamGroup[];
  collapsedGroupIds?: string[];
  onToggleGroupCollapse?: (groupId: string) => void;
};

const getCurrentTimePosition = (timezone: string): number => {
  const now = new Date();
  const timeString = now.toLocaleString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const [hours, minutes] = timeString.split(":").map(Number);
  return ((hours + minutes / 60) / 24) * 100;
};

const emptySubscribe = () => () => {};

const useClientValue = <T,>(clientValue: () => T, serverValue: T): T => {
  return useSyncExternalStore(emptySubscribe, clientValue, () => serverValue);
};

// Stable references for useSyncExternalStore to avoid infinite loops
let cachedTick = Date.now();
const tickSubscribe = (callback: () => void) => {
  const interval = setInterval(() => {
    cachedTick = Date.now();
    callback();
  }, 30000);
  return () => clearInterval(interval);
};
const getTickSnapshot = () => cachedTick;
const getTickServerSnapshot = () => 0;

type MemberRow = {
  member: TeamMember;
  hours: boolean[];
  dayOffset: number;
};

type GroupedSection = {
  group: TeamGroup | null;
  rows: MemberRow[];
};

// Selection can be either a member or a group
type Selection = {
  type: "member" | "group";
  id: string;
};

const TimezoneVisualizer = ({
  members,
  groups = [],
  collapsedGroupIds = [],
  onToggleGroupCollapse,
}: TimezoneVisualizerProps) => {
  // Convert to Set for O(1) lookup
  const collapsedSet = useMemo(
    () => new Set(collapsedGroupIds),
    [collapsedGroupIds]
  );

  // Helper to serialize/deserialize selection for Select component
  const serializeSelection = (sel: Selection): string => `${sel.type}:${sel.id}`;
  const deserializeSelection = (str: string): Selection | null => {
    const [type, id] = str.split(":");
    if ((type === "member" || type === "group") && id) {
      return { type, id };
    }
    return null;
  };

  // Compare mode state - starts empty, user opens it explicitly
  const [isComparing, setIsComparing] = useState(false);
  const [compareSelections, setCompareSelections] = useState<Selection[]>([]);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; relativeX: number; hour: number } | null>(null);
  const [isLineVisible, setIsLineVisible] = useState(false);
  const sectionsContainerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const lineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce line visibility - hide when moving fast, show when stopped
  useEffect(() => {
    if (hoverInfo === null) {
      setIsLineVisible(false);
      if (lineDebounceRef.current) {
        clearTimeout(lineDebounceRef.current);
        lineDebounceRef.current = null;
      }
      return;
    }

    // Hide immediately when position changes
    setIsLineVisible(false);

    // Clear existing timeout
    if (lineDebounceRef.current) {
      clearTimeout(lineDebounceRef.current);
    }

    // Show after a short delay (when mouse stops)
    lineDebounceRef.current = setTimeout(() => {
      setIsLineVisible(true);
    }, 50);

    return () => {
      if (lineDebounceRef.current) {
        clearTimeout(lineDebounceRef.current);
      }
    };
  }, [hoverInfo?.relativeX]);


  // Validate selections - remove any that no longer exist
  const validSelections = useMemo(() => {
    return compareSelections.filter((sel) => {
      if (sel.type === "member") {
        return members.some((m) => m.id === sel.id);
      }
      return groups.some((g) => g.id === sel.id);
    });
  }, [compareSelections, members, groups]);

  // Helper to add a selection
  const addSelection = useCallback((sel: Selection) => {
    setCompareSelections((prev) => {
      const key = serializeSelection(sel);
      if (prev.some((s) => serializeSelection(s) === key)) return prev;
      return [...prev, sel];
    });
  }, []);

  // Helper to remove a selection
  const removeSelection = useCallback((sel: Selection) => {
    setCompareSelections((prev) => {
      const key = serializeSelection(sel);
      return prev.filter((s) => serializeSelection(s) !== key);
    });
  }, []);

  // Get name for a selection
  const getSelectionName = useCallback((sel: Selection): string => {
    if (sel.type === "member") {
      return members.find((m) => m.id === sel.id)?.name ?? "Unknown";
    }
    return groups.find((g) => g.id === sel.id)?.name ?? "Unknown";
  }, [members, groups]);

  // Check if a selection is already selected
  const isSelectionSelected = useCallback((sel: Selection): boolean => {
    const key = serializeSelection(sel);
    return validSelections.some((s) => serializeSelection(s) === key);
  }, [validSelections]);

  const viewerTimezone = useClientValue(() => getUserTimezone(), "");
  const tick = useSyncExternalStore(
    tickSubscribe,
    getTickSnapshot,
    getTickServerSnapshot,
  );

  const nowPosition = useMemo(() => {
    if (!viewerTimezone) return null;
    void tick;
    return getCurrentTimePosition(viewerTimezone);
  }, [viewerTimezone, tick]);

  const memberRows = useMemo(() => {
    if (!viewerTimezone) return [];

    // Use tick to recalculate day offsets when time updates
    void tick;

    return members.map((member) => {
      const hours = new Array(24).fill(false);
      const startInViewerTz = convertHourToTimezone(
        member.workingHoursStart,
        member.timezone,
        viewerTimezone,
      );
      const endInViewerTz = convertHourToTimezone(
        member.workingHoursEnd,
        member.timezone,
        viewerTimezone,
      );

      if (startInViewerTz <= endInViewerTz) {
        for (let h = startInViewerTz; h < endInViewerTz; h++) {
          hours[h] = true;
        }
      } else {
        for (let h = startInViewerTz; h < 24; h++) {
          hours[h] = true;
        }
        for (let h = 0; h < endInViewerTz; h++) {
          hours[h] = true;
        }
      }

      const dayOffset = getDayOffset(member.timezone, viewerTimezone);

      return { member, hours, dayOffset };
    });
  }, [members, viewerTimezone, tick]);

  // Organize member rows by group (only show groups that have members)
  const groupedSections = useMemo((): GroupedSection[] => {
    if (groups.length === 0) {
      // No groups - show all members in a single ungrouped section
      return [{ group: null, rows: memberRows }];
    }

    const rowByMemberId = new Map(memberRows.map((row) => [row.member.id, row]));
    const sections: GroupedSection[] = [];

    // Add sections for each group that has members (sorted by order)
    const sortedGroups = [...groups].sort((a, b) => a.order - b.order);
    for (const group of sortedGroups) {
      const groupMembers = members.filter((m) => m.groupId === group.id);
      if (groupMembers.length === 0) continue; // Skip empty groups
      const rows = groupMembers
        .map((m) => rowByMemberId.get(m.id))
        .filter((row): row is MemberRow => row !== undefined);
      sections.push({ group, rows });
    }

    // Add ungrouped section at the end
    const ungroupedMembers = members.filter((m) => !m.groupId);
    if (ungroupedMembers.length > 0) {
      const rows = ungroupedMembers
        .map((m) => rowByMemberId.get(m.id))
        .filter((row): row is MemberRow => row !== undefined);
      sections.push({ group: null, rows });
    }

    return sections;
  }, [groups, members, memberRows]);

  // Get hours array for a selection (member or group)
  const getHoursForSelection = useCallback(
    (selection: Selection | null): boolean[] => {
      if (!selection) return new Array(24).fill(false);

      if (selection.type === "member") {
        const row = memberRows.find((r) => r.member.id === selection.id);
        return row?.hours ?? new Array(24).fill(false);
      }

      // Group: combine all member hours (true if ANY member in group is working)
      const groupMembers = members.filter((m) => m.groupId === selection.id);
      if (groupMembers.length === 0) return new Array(24).fill(false);

      const combinedHours = new Array(24).fill(false);
      for (const member of groupMembers) {
        const row = memberRows.find((r) => r.member.id === member.id);
        if (row) {
          for (let h = 0; h < 24; h++) {
            if (row.hours[h]) combinedHours[h] = true;
          }
        }
      }
      return combinedHours;
    },
    [memberRows, members]
  );

  // Count total people in selections (groups count as their member count)
  const totalPeopleSelected = useMemo(() => {
    let count = 0;
    for (const sel of validSelections) {
      if (sel.type === "member") {
        count += 1;
      } else {
        // Group - count all members in group
        count += members.filter((m) => m.groupId === sel.id).length;
      }
    }
    return count;
  }, [validSelections, members]);

  // Check if we can show overlap (at least 2 people total)
  const canShowOverlap = totalPeopleSelected >= 2;

  // Calculate overlap hours - intersection of ALL selected members/groups
  // Also calculate partial overlap (some but not all)
  const { overlapHours, partialOverlapHours, overlapCounts } = useMemo(() => {
    const empty = {
      overlapHours: new Array(24).fill(false) as boolean[],
      partialOverlapHours: new Array(24).fill(false) as boolean[],
      overlapCounts: new Array(24).fill(0) as number[],
    };
    if (!canShowOverlap) return empty;

    // Collect all individual member hours for overlap calculation
    const allMemberHours: boolean[][] = [];
    for (const sel of validSelections) {
      if (sel.type === "member") {
        const row = memberRows.find((r) => r.member.id === sel.id);
        if (row) allMemberHours.push(row.hours);
      } else {
        // Group - add each member's hours individually
        const groupMembers = members.filter((m) => m.groupId === sel.id);
        for (const member of groupMembers) {
          const row = memberRows.find((r) => r.member.id === member.id);
          if (row) allMemberHours.push(row.hours);
        }
      }
    }

    if (allMemberHours.length < 2) return empty;

    const totalPeople = allMemberHours.length;

    // Count how many people are working at each hour
    const counts = new Array(24).fill(0).map((_, hour) =>
      allMemberHours.filter((hours) => hours[hour]).length
    );

    // Full overlap = ALL members are working at that hour
    const full = counts.map((count) => count === totalPeople);

    // Partial overlap = at least 2 people working, but not all
    const partial = counts.map((count, hour) => count >= 2 && !full[hour]);

    return {
      overlapHours: full,
      partialOverlapHours: partial,
      overlapCounts: counts,
    };
  }, [canShowOverlap, validSelections, memberRows, members]);

  // Calculate overlap status: none, partial, full, or mixed
  // - none: no hours where at least 2 people overlap
  // - partial: only partial overlap hours (some but not all people)
  // - full: only full overlap hours (all people)
  // - mixed: has both partial and full overlap hours
  const overlapStatus = useMemo(() => {
    const hasFullOverlap = overlapHours.some(Boolean);
    const hasPartialOverlap = partialOverlapHours.some(Boolean);

    if (!hasFullOverlap && !hasPartialOverlap) return "none" as const;
    if (hasFullOverlap && hasPartialOverlap) return "mixed" as const;
    if (hasFullOverlap) return "full" as const;
    return "partial" as const;
  }, [overlapHours, partialOverlapHours]);

  // Get members from a selection (for showing in hover tooltip)
  const getMembersForSelection = useCallback(
    (selection: Selection | null): TeamMember[] => {
      if (!selection) return [];
      if (selection.type === "member") {
        const member = members.find((m) => m.id === selection.id);
        return member ? [member] : [];
      }
      // Group
      return members.filter((m) => m.groupId === selection.id);
    },
    [members]
  );

  // Get all members available at a specific hour from all selections
  const getAvailableMembersAtHour = useCallback(
    (hour: number): Map<string, TeamMember[]> => {
      const result = new Map<string, TeamMember[]>();

      for (const sel of validSelections) {
        const selMembers = getMembersForSelection(sel);
        const available = selMembers.filter((m) => {
          const row = memberRows.find((r) => r.member.id === m.id);
          return row?.hours[hour] ?? false;
        });
        result.set(serializeSelection(sel), available);
      }

      return result;
    },
    [validSelections, getMembersForSelection, memberRows]
  );

  // Check if a member is part of any current selection (for highlighting)
  const isMemberInCompare = useCallback(
    (memberId: string): boolean => {
      if (!isComparing || validSelections.length === 0) return false;

      for (const sel of validSelections) {
        if (sel.type === "member" && sel.id === memberId) return true;
        if (sel.type === "group") {
          const member = members.find((m) => m.id === memberId);
          if (member?.groupId === sel.id) return true;
        }
      }
      return false;
    },
    [isComparing, validSelections, members]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !sectionsContainerRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const containerRect = sectionsContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const relativeX = e.clientX - containerRect.left;
    const percentage = x / rect.width;
    const hour = Math.floor(percentage * 24);
    const clampedHour = Math.max(0, Math.min(23, hour));
    setHoverInfo((prev) => {
      if (
        prev &&
        prev.hour === clampedHour &&
        prev.x === x &&
        prev.relativeX === relativeX
      ) {
        return prev;
      }
      return { x, relativeX, hour: clampedHour };
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverInfo(null);
  }, []);

  if (members.length === 0 || !viewerTimezone) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex flex-col gap-6">
      {/* Time axis with tick marks */}
      <div className="flex gap-2 sm:gap-3">
        <div className="w-8 shrink-0 sm:w-24" />
        <div className="flex flex-1 justify-between">
          {[0, 6, 12, 18, 24].map((hour, index, arr) => {
            const isFirst = index === 0;
            const isLast = index === arr.length - 1;
            return (
              <div
                key={hour}
                className="flex flex-col"
                style={{
                  alignItems: isFirst ? "flex-start" : isLast ? "flex-end" : "center",
                }}
              >
                <span className="whitespace-nowrap text-[10px] tabular-nums text-neutral-600 dark:text-neutral-400 sm:text-xs">
                  {formatHour(hour % 24)}
                </span>
                <div className="mt-1 h-1.5 w-px bg-neutral-300 dark:bg-neutral-600" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Member rows container with global current time indicator */}
      <div ref={sectionsContainerRef} className="relative flex flex-col gap-4">
        {/* Global current time indicator - spans all sections */}
        {/* Mobile version: offset = 2rem (w-8) + 0.5rem (gap-2) = 2.5rem */}
        {nowPosition !== null && (
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 rounded-full bg-red-500 shadow-sm sm:hidden"
            style={{
              left: `calc(2.5rem + (100% - 2.5rem) * ${nowPosition / 100})`,
            }}
          >
            <div className="absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-red-500" />
          </div>
        )}
        {/* Desktop version: offset = 6rem (w-24) + 0.75rem (gap-3) = 6.75rem */}
        {nowPosition !== null && (
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-20 hidden w-0.5 rounded-full bg-red-500 shadow-sm sm:block"
            style={{
              left: `calc(6.75rem + (100% - 6.75rem) * ${nowPosition / 100})`,
            }}
          >
            <div className="absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-red-500" />
          </div>
        )}

        {/* Hover line spanning all grouped rows */}
        {hoverInfo !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 z-30 w-px bg-neutral-400/60 transition-opacity duration-150 ease-out dark:bg-neutral-500/60"
            style={{
              left: `${hoverInfo.relativeX}px`,
              opacity: isLineVisible ? 1 : 0,
            }}
          />
        )}

        {groupedSections.map((section, sectionIndex) => {
          const isCollapsed = section.group ? collapsedSet.has(section.group.id) : false;
          const visibleRows = isCollapsed ? [] : section.rows;

          return (
            <div key={section.group?.id ?? "ungrouped"} className="flex flex-col gap-3">
              {/* Group header */}
              {section.group && (
                <button
                  type="button"
                  onClick={() => onToggleGroupCollapse?.(section.group!.id)}
                  className="-ml-1.5 flex items-center gap-2 rounded-md px-1.5 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                >
                  <ChevronRight
                    className={`h-3 w-3 transition-transform duration-150 ${isCollapsed ? "" : "rotate-90"}`}
                  />
                  <span>{section.group.name}</span>
                  <span className="text-neutral-500 dark:text-neutral-400">
                    ({section.rows.length})
                  </span>
                </button>
              )}

              {/* Ungrouped header (only show if there are groups) */}
              {!section.group && groups.length > 0 && (
                <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  <span>Ungrouped</span>
                  <span>({section.rows.length})</span>
                </div>
              )}

              {/* Member rows */}
              <AnimatePresence initial={false}>
                {visibleRows.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-stretch gap-2 sm:gap-3">
                      {/* Names column */}
                      <div className="flex w-8 shrink-0 flex-col gap-3 sm:w-24">
                        {visibleRows.map(({ member, dayOffset }) => {
                          const isSelected = isMemberInCompare(member.id);
                          const dayOffsetLabel = dayOffset > 0
                            ? `${Math.abs(dayOffset)} day${Math.abs(dayOffset) > 1 ? "s" : ""} ahead`
                            : dayOffset < 0
                              ? `${Math.abs(dayOffset)} day${Math.abs(dayOffset) > 1 ? "s" : ""} behind`
                              : null;

                          const content = (
                            <div
                              className="flex h-8 items-center justify-center sm:justify-start sm:gap-2"
                            >
                              <div className="relative">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900 sm:h-7 sm:w-7 sm:text-xs">
                                  {member.name.charAt(0).toUpperCase()}
                                </div>
                                {isSelected && members.length > 1 && (
                                  <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-50 bg-neutral-900 dark:border-neutral-900 dark:bg-neutral-50 sm:h-3 sm:w-3" />
                                )}
                                {dayOffset !== 0 && (
                                  <div className="absolute -bottom-0.5 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[8px] font-bold text-amber-950 dark:bg-amber-500 dark:text-amber-950 sm:h-4 sm:w-4 sm:text-[9px]">
                                    {dayOffset > 0 ? `+${dayOffset}` : dayOffset}
                                  </div>
                                )}
                              </div>
                              <span className="hidden truncate text-sm font-medium text-neutral-700 dark:text-neutral-300 sm:block">
                                {member.name}
                              </span>
                            </div>
                          );

                          if (dayOffsetLabel) {
                            return (
                              <Tooltip key={member.id}>
                                <TooltipTrigger asChild>
                                  {content}
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  <span>{dayOffsetLabel}</span>
                                </TooltipContent>
                              </Tooltip>
                            );
                          }

                          return <div key={member.id}>{content}</div>;
                        })}
                      </div>

                      {/* Timeline container */}
                      <div
                        ref={sectionIndex === 0 ? timelineRef : undefined}
                        className="relative flex-1 cursor-crosshair"
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                      >
                        {/* Hover tooltip */}
                        {sectionIndex === 0 && hoverInfo !== null && (
                          <div
                            className="pointer-events-none absolute z-30 -translate-x-1/2 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs ring-1 ring-neutral-950/5 dark:border-neutral-700 dark:bg-neutral-800 dark:ring-white/10"
                            style={{
                              left: `${hoverInfo.x}px`,
                              top: "-40px",
                            }}
                          >
                            <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                              {formatHour(hoverInfo.hour)}
                            </span>
                          </div>
                        )}

                        {/* Hour bars */}
                        <div className="flex flex-col gap-3">
                          {visibleRows.map(({ member, hours }) => (
                              <div
                                key={member.id}
                                className="flex h-8 gap-px overflow-hidden rounded-lg bg-neutral-200 p-1 dark:bg-neutral-900"
                              >
                                {hours.map((isWorking, hour) => (
                                  <Tooltip key={hour}>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={`h-full flex-1 ${
                                          hour === 0 ? "rounded-l" : hour === 23 ? "rounded-r" : ""
                                        } ${
                                          isWorking
                                            ? "bg-neutral-900 dark:bg-neutral-50"
                                            : "bg-neutral-300 dark:bg-neutral-700"
                                        }`}
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <div className="font-medium tabular-nums">
                                        {formatHour(hour)}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                ))}
                              </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Find Best Time - Compare Timezones */}
      {members.length >= 2 && (
        <AnimatePresence mode="wait">
          {!isComparing ? (
            <motion.div
              key="compare-button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                variant="outline"
                type="button"
                className="group flex h-14 w-full items-center justify-center gap-2 border-2 border-dashed border-neutral-200 bg-neutral-50/50 text-neutral-600 hover:border-neutral-400 hover:bg-neutral-100/50 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/50"
                onClick={() => setIsComparing(true)}
              >
                <Clock className="h-5 w-5 transition-transform group-hover:scale-110" />
                <span className="font-medium">Find Best Meeting Time</span>
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="compare-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <Card className="flex flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900 dark:bg-neutral-100">
                      <Clock className="h-4 w-4 text-white dark:text-neutral-900" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        Find Best Meeting Time
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Select people or groups to compare
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                    onClick={() => {
                      setIsComparing(false);
                      setCompareSelections([]);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Selections */}
                <div className="flex flex-wrap items-center gap-2">
                  {validSelections.map((sel) => (
                    <Badge
                      key={serializeSelection(sel)}
                      variant="secondary"
                      className="flex items-center gap-1.5 py-1 pl-2 pr-1"
                    >
                      {sel.type === "group" && <Users className="h-3 w-3" />}
                      <span>{getSelectionName(sel)}</span>
                      <button
                        type="button"
                        onClick={() => removeSelection(sel)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-neutral-300 dark:hover:bg-neutral-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}

                  {/* Add selector */}
                  <Select
                    value=""
                    onValueChange={(val) => {
                      const sel = deserializeSelection(val);
                      if (sel) addSelection(sel);
                    }}
                  >
                    {validSelections.length === 0 ? (
                      <SelectTrigger className="h-8 w-auto gap-1.5 border-dashed px-3 [&>svg:last-child]:hidden">
                        <Plus className="h-4 w-4" />
                        <span className="text-sm">Add</span>
                      </SelectTrigger>
                    ) : (
                      <SelectTrigger className="h-7 w-7 justify-center rounded-full border-dashed p-0 [&>svg:last-child]:hidden">
                        <Plus className="h-4 w-4" />
                      </SelectTrigger>
                    )}
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Members</SelectLabel>
                        {members.map((member) => {
                          const sel: Selection = { type: "member", id: member.id };
                          const isAlreadySelected = isSelectionSelected(sel);
                          return (
                            <SelectItem
                              key={`member:${member.id}`}
                              value={serializeSelection(sel)}
                              disabled={isAlreadySelected}
                            >
                              {member.name}
                              {isAlreadySelected && (
                                <Check className="ml-auto h-3 w-3 text-neutral-400" />
                              )}
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                      {groups.filter((g) => members.some((m) => m.groupId === g.id)).length > 0 && (
                        <>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel>Groups</SelectLabel>
                            {groups
                              .filter((g) => members.some((m) => m.groupId === g.id))
                              .map((group) => {
                                const sel: Selection = { type: "group", id: group.id };
                                const isAlreadySelected = isSelectionSelected(sel);
                                return (
                                  <SelectItem
                                    key={`group:${group.id}`}
                                    value={serializeSelection(sel)}
                                    disabled={isAlreadySelected}
                                  >
                                    <span className="flex items-center gap-2">
                                      <Users className="h-3 w-3" />
                                      {group.name}
                                    </span>
                                    {isAlreadySelected && (
                                      <Check className="ml-auto h-3 w-3 text-neutral-400" />
                                    )}
                                  </SelectItem>
                                );
                              })}
                          </SelectGroup>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Overlap result */}
                {canShowOverlap && (
                  <div className="flex flex-col gap-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                    {/* Time range info - only show when there is overlap */}
                    <p className="text-right text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                      {(() => {
                        // Combine full and partial overlap for summary
                        const anyOverlap = overlapHours.map((full, i) => full || partialOverlapHours[i]);
                        const start = anyOverlap.findIndex(Boolean);
                        const end = anyOverlap.lastIndexOf(true);
                        if (start === -1 || end === -1) return null;
                        const fullHours = overlapHours.filter(Boolean).length;
                        const partialHoursCount = partialOverlapHours.filter(Boolean).length;
                        const endExclusive = end + 1;
                        return (
                          <span>
                            {formatHour(start)} – {formatHour(endExclusive % 24)}
                            <span className="ml-1">
                              ({fullHours}h full{partialHoursCount > 0 ? `, ${partialHoursCount}h partial` : ""})
                            </span>
                          </span>
                        );
                      })()}
                    </p>
                    {/* Overlap row - following same pattern as member rows */}
                    <div className="flex items-stretch gap-2 sm:gap-3">
                      {/* Icon + label column - aligned with avatars */}
                      <div className="flex w-8 shrink-0 flex-col sm:w-24">
                        <div className="flex h-8 items-center justify-center sm:justify-start sm:gap-2">
                          {overlapStatus === "none" && (
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 sm:h-7 sm:w-7">
                              <X className="h-3 w-3 text-red-600 dark:text-red-400 sm:h-3.5 sm:w-3.5" />
                            </div>
                          )}
                          {overlapStatus === "partial" && (
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 sm:h-7 sm:w-7">
                              <Minus className="h-3 w-3 text-amber-600 dark:text-amber-400 sm:h-3.5 sm:w-3.5" />
                            </div>
                          )}
                          {(overlapStatus === "mixed" || overlapStatus === "full") && (
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 sm:h-7 sm:w-7">
                              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 sm:h-3.5 sm:w-3.5" />
                            </div>
                          )}
                          <span className="hidden truncate text-sm font-medium text-neutral-700 dark:text-neutral-300 sm:block">
                            {overlapStatus === "none" ? "No overlap" : "Overlap"}
                          </span>
                        </div>
                      </div>

                      {/* Overlap bar */}
                      <div className="flex-1">
                        <div className="flex h-8 gap-px overflow-hidden rounded-lg bg-neutral-200 p-1 dark:bg-neutral-900">
                        {Array.from({ length: 24 }, (_, hour) => {
                          const isFullOverlap = overlapHours[hour];
                          const isPartialOverlap = partialOverlapHours[hour];
                          const hasAnyOverlap = isFullOverlap || isPartialOverlap;

                          // Determine color based on overlap type for this specific hour
                          let overlapColor: string;
                          if (isFullOverlap) {
                            overlapColor = "bg-emerald-500 dark:bg-emerald-400";
                          } else if (isPartialOverlap) {
                            overlapColor = "bg-amber-500 dark:bg-amber-400";
                          } else {
                            overlapColor = "bg-neutral-300 dark:bg-neutral-700";
                          }

                          if (!hasAnyOverlap) {
                            return (
                              <Tooltip key={hour}>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`h-6 flex-1 ${
                                      hour === 0 ? "rounded-l" : hour === 23 ? "rounded-r" : ""
                                    } bg-neutral-300 dark:bg-neutral-700`}
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <div className="font-medium tabular-nums">
                                    {formatHour(hour)}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          }

                          const availableMap = getAvailableMembersAtHour(hour);
                          const overlapLabel = isFullOverlap
                            ? `All ${totalPeopleSelected} available`
                            : `${overlapCounts[hour]} of ${totalPeopleSelected} available`;

                          return (
                            <Tooltip key={hour}>
                              <TooltipTrigger asChild>
                                <div
                                  className={`h-6 flex-1 ${
                                    hour === 0 ? "rounded-l" : hour === 23 ? "rounded-r" : ""
                                  } ${overlapColor}`}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <div className="font-medium tabular-nums text-neutral-900 dark:text-neutral-50">
                                  {formatHour(hour)}
                                </div>
                                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                  {overlapLabel}
                                </div>
                                <div className="mt-1 flex flex-col gap-1">
                                  {validSelections.map((sel) => {
                                    const available = availableMap.get(serializeSelection(sel)) ?? [];
                                    if (available.length === 0) return null;
                                    const isGroup = sel.type === "group";
                                    return (
                                      <div key={serializeSelection(sel)}>
                                        {isGroup ? (
                                          <>
                                            <span className="text-neutral-500 dark:text-neutral-400">
                                              {getSelectionName(sel)}:
                                            </span>{" "}
                                            <span className="text-neutral-800 dark:text-neutral-200">
                                              {available.map((m) => m.name).join(", ")}
                                            </span>
                                          </>
                                        ) : (
                                          <span className="text-neutral-800 dark:text-neutral-200">
                                            {available.map((m) => m.name).join(", ")}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!canShowOverlap && (
                  <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
                    Select at least 2 people to find overlapping times
                  </p>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-neutral-900 dark:bg-neutral-100" />
          <span>Working hours</span>
        </div>
        {isComparing && canShowOverlap && (
          <>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-emerald-500 dark:bg-emerald-400" />
              <span>Full overlap</span>
            </div>
            {totalPeopleSelected >= 3 && (
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-amber-500 dark:bg-amber-400" />
                <span>Partial overlap</span>
              </div>
            )}
          </>
        )}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center">
            <div className="h-3 w-0.5 rounded-full bg-red-500" />
            <div className="-ml-px h-1.5 w-1.5 rounded-full bg-red-500" />
          </div>
          <span>Current time</span>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
};

export { TimezoneVisualizer };
