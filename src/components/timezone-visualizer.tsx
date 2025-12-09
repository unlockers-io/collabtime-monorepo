"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Check, ChevronRight, Users } from "lucide-react";
import type { TeamGroup, TeamMember } from "@/types";
import { convertHourToTimezone, getUserTimezone } from "@/lib/timezones";
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
const tickSubscribe = (callback: () => void) => {
  const interval = setInterval(callback, 30000);
  return () => clearInterval(interval);
};
const getTickSnapshot = () => Date.now();
const getTickServerSnapshot = () => 0;

type MemberRow = {
  member: TeamMember;
  hours: boolean[];
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

  const [selectedA, setSelectedA] = useState<Selection | null>(
    () => {
      const first = members[0];
      return first ? { type: "member", id: first.id } : null;
    },
  );
  const [selectedB, setSelectedB] = useState<Selection | null>(() => {
    const first = members[0]?.id;
    const second = members.find((m) => m.id !== first);
    return second ? { type: "member", id: second.id } : null;
  });
  const [hoverInfo, setHoverInfo] = useState<{ x: number; relativeX: number; hour: number } | null>(null);
  const [overlapHoverHour, setOverlapHoverHour] = useState<number | null>(null);
  const sectionsContainerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const overlapBarRef = useRef<HTMLDivElement>(null);

  // Derive safe selections without triggering state updates to avoid render loops
  const activeA = useMemo((): Selection | null => {
    if (!members.length) return null;
    if (!selectedA) return { type: "member", id: members[0].id };
    if (selectedA.type === "member") {
      return members.some((m) => m.id === selectedA.id)
        ? selectedA
        : { type: "member", id: members[0].id };
    }
    // group
    if (groups.some((g) => g.id === selectedA.id)) {
      return selectedA;
    }
    return { type: "member", id: members[0].id };
  }, [members, groups, selectedA]);

  const activeB = useMemo((): Selection | null => {
    if (!members.length) return null;
    if (!selectedB) {
      const second = members.find((m) => m.id !== activeA?.id);
      return second ? { type: "member", id: second.id } : { type: "member", id: members[0].id };
    }
    if (selectedB.type === "member") {
      if (members.some((m) => m.id === selectedB.id)) return selectedB;
      const fallback = members.find((m) => m.id !== activeA?.id) ?? members[0];
      return { type: "member", id: fallback.id };
    }
    if (groups.some((g) => g.id === selectedB.id)) return selectedB;
    const fallback = members.find((m) => m.id !== activeA?.id) ?? members[0];
    return { type: "member", id: fallback.id };
  }, [members, groups, selectedB, activeA]);

  const activeAValue = activeA ? serializeSelection(activeA) : "";
  const activeBValue = activeB ? serializeSelection(activeB) : "";

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

      return { member, hours };
    });
  }, [members, viewerTimezone]);

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

  const selectedAHours = useMemo(
    () => getHoursForSelection(activeA),
    [activeA, getHoursForSelection]
  );
  const selectedBHours = useMemo(
    () => getHoursForSelection(activeB),
    [activeB, getHoursForSelection]
  );

  // Calculate overlap hours between selected pair
  const overlapHours = useMemo(() => {
    if (!activeA || !activeB) return new Array(24).fill(false);
    return new Array(24)
      .fill(false)
      .map((_, hour) => selectedAHours[hour] && selectedBHours[hour]);
  }, [activeA, activeB, selectedAHours, selectedBHours]);

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

  // Get members available at a specific hour
  const getAvailableMembersAtHour = useCallback(
    (hour: number): { a: TeamMember[]; b: TeamMember[] } => {
      const aMembersList = getMembersForSelection(activeA);
      const bMembersList = getMembersForSelection(activeB);

      const aAvailable = aMembersList.filter((m) => {
        const row = memberRows.find((r) => r.member.id === m.id);
        return row?.hours[hour] ?? false;
      });

      const bAvailable = bMembersList.filter((m) => {
        const row = memberRows.find((r) => r.member.id === m.id);
        return row?.hours[hour] ?? false;
      });

      return { a: aAvailable, b: bAvailable };
    },
    [activeA, activeB, getMembersForSelection, memberRows]
  );

  // Check if a member is part of the current selection
  const isMemberSelected = useCallback(
    (memberId: string): boolean => {
      if (activeA?.type === "member" && activeA.id === memberId) return true;
      if (activeB?.type === "member" && activeB.id === memberId) return true;
      if (activeA?.type === "group") {
        const member = members.find((m) => m.id === memberId);
        if (member?.groupId === activeA.id) return true;
      }
      if (activeB?.type === "group") {
        const member = members.find((m) => m.id === memberId);
        if (member?.groupId === activeB.id) return true;
      }
      return false;
    },
    [activeA, activeB, members]
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
                <span className="whitespace-nowrap text-[10px] tabular-nums text-neutral-400 dark:text-neutral-500 sm:text-xs">
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
            className="pointer-events-none absolute inset-y-0 z-30 w-px bg-neutral-400/60 dark:bg-neutral-500/60"
            style={{
              left: `${hoverInfo.relativeX}px`,
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
                  className="flex items-center gap-2 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                >
                  <ChevronRight
                    className={`h-3 w-3 transition-transform duration-150 ${isCollapsed ? "" : "rotate-90"}`}
                  />
                  <span>{section.group.name}</span>
                  <span className="text-neutral-400 dark:text-neutral-500">
                    ({section.rows.length})
                  </span>
                </button>
              )}

              {/* Ungrouped header (only show if there are groups) */}
              {!section.group && groups.length > 0 && (
                <div className="flex items-center gap-2 text-xs font-medium text-neutral-400 dark:text-neutral-500">
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
                        {visibleRows.map(({ member }) => {
                          const isSelected = isMemberSelected(member.id);
                          return (
                            <div
                              key={member.id}
                              className="flex h-8 items-center justify-center sm:justify-start sm:gap-2"
                            >
                              <div className="relative">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900 sm:h-7 sm:w-7 sm:text-xs">
                                  {member.name.charAt(0).toUpperCase()}
                                </div>
                                {isSelected && members.length > 1 && (
                                  <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-50 bg-neutral-900 dark:border-neutral-900 dark:bg-neutral-50 sm:h-3 sm:w-3" />
                                )}
                              </div>
                              <span className="hidden truncate text-sm font-medium text-neutral-700 dark:text-neutral-300 sm:block">
                                {member.name}
                              </span>
                            </div>
                          );
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
                            className="pointer-events-none absolute z-30 -translate-x-1/2 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
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
                              className="flex h-8 gap-px overflow-hidden rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800"
                            >
                              {hours.map((isWorking, hour) => {
                                const classes = `h-full flex-1 transition-colors ${
                                  hour === 0 ? "rounded-l" : hour === 23 ? "rounded-r" : ""
                                } ${
                                  isWorking
                                    ? "bg-neutral-900 dark:bg-neutral-100"
                                    : "bg-neutral-200/50 dark:bg-neutral-700/50"
                                }`;

                                return (
                                  <Tooltip key={hour}>
                                    <TooltipTrigger asChild>
                                      <div className={classes} />
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <div className="font-medium tabular-nums">
                                        {formatHour(hour)}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
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

      {/* Overlap indicator */}
      {members.length > 1 && (
        <div className="flex flex-col gap-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
              <Select
                value={activeAValue}
                onValueChange={(val) => {
                  const sel = deserializeSelection(val);
                  if (sel && val !== activeAValue) setSelectedA(sel);
                }}
              >
                <SelectTrigger className="h-9 w-full sm:w-auto sm:min-w-40">
                  <SelectValue>
                    {activeA?.type === "member"
                      ? members.find((m) => m.id === activeA.id)?.name
                      : activeA?.type === "group"
                        ? groups.find((g) => g.id === activeA.id)?.name
                        : "Select..."}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Members</SelectLabel>
                    {members.map((member) => {
                      const val = serializeSelection({ type: "member", id: member.id });
                      return (
                        <SelectItem
                          key={`member:${member.id}`}
                          value={val}
                          disabled={val === activeBValue}
                        >
                          {member.name}
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
                            const val = serializeSelection({ type: "group", id: group.id });
                            return (
                              <SelectItem
                                key={`group:${group.id}`}
                                value={val}
                                disabled={val === activeBValue}
                              >
                                <span className="flex items-center gap-2">
                                  <Users className="h-3 w-3" />
                                  {group.name}
                                </span>
                              </SelectItem>
                            );
                          })}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
              <Select
                value={activeBValue}
                onValueChange={(val) => {
                  const sel = deserializeSelection(val);
                  if (sel && val !== activeBValue) setSelectedB(sel);
                }}
              >
                <SelectTrigger className="h-9 w-full sm:w-auto sm:min-w-40">
                  <SelectValue>
                    {activeB?.type === "member"
                      ? members.find((m) => m.id === activeB.id)?.name
                      : activeB?.type === "group"
                        ? groups.find((g) => g.id === activeB.id)?.name
                        : "Select..."}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Members</SelectLabel>
                    {members.map((member) => {
                      const val = serializeSelection({ type: "member", id: member.id });
                      return (
                        <SelectItem
                          key={`member:${member.id}`}
                          value={val}
                          disabled={val === activeAValue}
                        >
                          {member.name}
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
                            const val = serializeSelection({ type: "group", id: group.id });
                            return (
                              <SelectItem
                                key={`group:${group.id}`}
                                value={val}
                                disabled={val === activeAValue}
                              >
                                <span className="flex items-center gap-2">
                                  <Users className="h-3 w-3" />
                                  {group.name}
                                </span>
                              </SelectItem>
                            );
                          })}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs tabular-nums text-neutral-600 dark:text-neutral-300 sm:text-sm">
              Overlap:{" "}
              <span className="font-medium">
                {(() => {
                  const start = overlapHours.findIndex(Boolean);
                  const end = overlapHours.lastIndexOf(true);
                  if (start === -1 || end === -1) return "No overlap";
                  const endExclusive = end + 1;
                  return `${formatHour(start)} – ${formatHour(endExclusive % 24)}`;
                })()}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex w-8 shrink-0 items-center justify-center sm:w-24 sm:justify-start sm:gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 sm:h-7 sm:w-7">
                <Check className="h-3 w-3 text-neutral-600 dark:text-neutral-400 sm:h-3.5 sm:w-3.5" />
              </div>
              <span className="hidden text-sm font-medium text-neutral-700 dark:text-neutral-300 sm:block">
                Overlap
              </span>
            </div>

            <div
              ref={overlapBarRef}
              className="relative flex flex-1 cursor-crosshair gap-px overflow-hidden rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800"
              onMouseLeave={() => setOverlapHoverHour(null)}
            >
              {overlapHours.map((isOverlap, hour) => {
                const baseCell = (
                  <div
                    className={`h-6 flex-1 transition-colors ${
                      hour === 0 ? "rounded-l" : hour === 23 ? "rounded-r" : ""
                    } ${
                      isOverlap
                        ? "bg-neutral-600 dark:bg-neutral-400"
                        : "bg-neutral-200/50 dark:bg-neutral-700/50"
                    } ${overlapHoverHour === hour ? "ring-2 ring-neutral-400 ring-inset" : ""}`}
                    onMouseEnter={() =>
                      setOverlapHoverHour((prev) =>
                        isOverlap && prev !== hour ? hour : isOverlap ? prev : null
                      )
                    }
                  />
                );

                if (!isOverlap) {
                  return (
                    <div
                      key={hour}
                      className={`h-6 flex-1 transition-colors ${
                        hour === 0 ? "rounded-l" : hour === 23 ? "rounded-r" : ""
                      } ${
                        isOverlap
                          ? "bg-neutral-600 dark:bg-neutral-400"
                          : "bg-neutral-200/50 dark:bg-neutral-700/50"
                      } ${overlapHoverHour === hour ? "ring-2 ring-neutral-400 ring-inset" : ""}`}
                    />
                  );
                }

                const { a, b } = getAvailableMembersAtHour(hour);
                const aName = activeA?.type === "member"
                  ? members.find((m) => m.id === activeA.id)?.name
                  : groups.find((g) => g.id === activeA?.id)?.name;
                const bName = activeB?.type === "member"
                  ? members.find((m) => m.id === activeB.id)?.name
                  : groups.find((g) => g.id === activeB?.id)?.name;

                return (
                  <Tooltip key={hour}>
                    <TooltipTrigger asChild>{baseCell}</TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="font-medium tabular-nums text-neutral-900 dark:text-neutral-50">
                        {formatHour(hour)}
                      </div>
                      <div className="mt-1 flex flex-col gap-1">
                        {a.length > 0 && (
                          <div>
                            {activeA?.type === "group" ? (
                              <>
                                <span className="text-neutral-500 dark:text-neutral-400">
                                  {aName}:
                                </span>{" "}
                                <span className="text-neutral-800 dark:text-neutral-200">
                                  {a.map((m) => m.name).join(", ")}
                                </span>
                              </>
                            ) : (
                              <span className="text-neutral-800 dark:text-neutral-200">
                                {a.map((m) => m.name).join(", ")}
                              </span>
                            )}
                          </div>
                        )}
                        {b.length > 0 && (
                          <div>
                            {activeB?.type === "group" ? (
                              <>
                                <span className="text-neutral-500 dark:text-neutral-400">
                                  {bName}:
                                </span>{" "}
                                <span className="text-neutral-800 dark:text-neutral-200">
                                  {b.map((m) => m.name).join(", ")}
                                </span>
                              </>
                            ) : (
                              <span className="text-neutral-800 dark:text-neutral-200">
                                {b.map((m) => m.name).join(", ")}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-neutral-900 dark:bg-neutral-100" />
          <span>Working hours</span>
        </div>
        {members.length > 1 && (
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-neutral-600 dark:bg-neutral-400" />
            <span>Overlap</span>
          </div>
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
