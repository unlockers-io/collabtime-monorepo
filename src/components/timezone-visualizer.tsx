"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AnimatePresence, motion, useMotionValue, animate } from "motion/react";
import { useTheme } from "next-themes";
import {
  Check,
  ChevronRight,
  Clock,
  Minus,
  Plus,
  Users,
  X,
} from "lucide-react";

import type { TeamGroup, TeamMember } from "@/types";
import { convertHourToTimezone, getDayOffset, getUserTimezone } from "@/lib/timezones";
import { formatHour } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================================
// Types
// ============================================================================

type TimezoneVisualizerProps = {
  members: TeamMember[];
  groups?: TeamGroup[];
  collapsedGroupIds?: string[];
  onToggleGroupCollapse?: (groupId: string) => void;
};

type MemberRow = {
  member: TeamMember;
  hours: boolean[];
  dayOffset: number;
};

type GroupedSection = {
  group: TeamGroup | null;
  rows: MemberRow[];
};

type Selection = {
  type: "member" | "group";
  id: string;
};

type OverlapStatus = "none" | "partial" | "full" | "mixed";

type OverlapData = {
  overlapHours: boolean[];
  partialOverlapHours: boolean[];
  crossTeamOverlapHours: boolean[];
  overlapCounts: number[];
};

// ============================================================================
// Constants
// ============================================================================

const HOURS_IN_DAY = 24;
const TIME_AXIS_HOURS = [0, 6, 12, 18, 24];
const TICK_INTERVAL_MS = 30_000;
const HOVER_HIDE_DELAY_MS = 800;
const PULSE_DURATION_MS = 500;

const EMPTY_HOURS = new Array<boolean>(HOURS_IN_DAY).fill(false);
const EMPTY_COUNTS = new Array<number>(HOURS_IN_DAY).fill(0);

const EMPTY_OVERLAP_DATA: OverlapData = {
  overlapHours: EMPTY_HOURS,
  partialOverlapHours: EMPTY_HOURS,
  crossTeamOverlapHours: EMPTY_HOURS,
  overlapCounts: EMPTY_COUNTS,
};

// Theme-aware color tokens (hex values for direct DOM manipulation)
const COLORS = {
  light: {
    working: "#171717",
    notWorking: "#d4d4d4",
    highlight: "#10b981",
  },
  dark: {
    working: "#fafafa",
    notWorking: "#404040",
    highlight: "#34d399",
  },
} as const;

// ============================================================================
// Utilities
// ============================================================================

const getCurrentTimePosition = (timezone: string): number => {
  const now = new Date();
  const timeString = now.toLocaleString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const [hours, minutes] = timeString.split(":").map(Number);
  return ((hours + minutes / 60) / HOURS_IN_DAY) * 100;
};

const serializeSelection = (sel: Selection): string => `${sel.type}:${sel.id}`;

const deserializeSelection = (str: string): Selection | null => {
  const [type, id] = str.split(":");
  if ((type === "member" || type === "group") && id) {
    return { type, id };
  }
  return null;
};

const formatDayOffset = (offset: number): string | null => {
  if (offset === 0) return null;
  const absOffset = Math.abs(offset);
  const suffix = absOffset > 1 ? "days" : "day";
  return offset > 0 ? `${absOffset} ${suffix} ahead` : `${absOffset} ${suffix} behind`;
};

const getRoundedCornerClass = (hour: number): string => {
  if (hour === 0) return "rounded-l";
  if (hour === HOURS_IN_DAY - 1) return "rounded-r";
  return "";
};

// ============================================================================
// Hooks
// ============================================================================

const emptySubscribe = () => () => {};

const useClientValue = <T,>(clientValue: () => T, serverValue: T): T =>
  useSyncExternalStore(emptySubscribe, clientValue, () => serverValue);

// Stable tick for time updates (avoids infinite loops with useSyncExternalStore)
let cachedTick = Date.now();

const tickSubscribe = (callback: () => void) => {
  const interval = setInterval(() => {
    cachedTick = Date.now();
    callback();
  }, TICK_INTERVAL_MS);
  return () => clearInterval(interval);
};

const getTickSnapshot = () => cachedTick;
const getTickServerSnapshot = () => 0;

// ============================================================================
// Memoized Sub-Components
// ============================================================================

type HourBlockProps = {
  hour: number;
  isWorking: boolean;
  isDark: boolean;
  selectedBlockRef: React.RefObject<number | null>;
  onClickRef: React.RefObject<(hour: number) => void>;
};

const HourBlock = memo(function HourBlock({
  hour,
  isWorking,
  isDark,
  selectedBlockRef,
  onClickRef,
}: HourBlockProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isAnimatingRef = useRef(false);

  const colors = isDark ? COLORS.dark : COLORS.light;
  const baseColor = isWorking ? colors.working : colors.notWorking;

  useEffect(() => {
    let animationId: number;
    let lastSelected: number | null = null;

    const checkSelection = () => {
      const currentSelected = selectedBlockRef.current;

      if (currentSelected !== lastSelected) {
        lastSelected = currentSelected;

        const shouldAnimate =
          currentSelected === hour && isWorking && !isAnimatingRef.current;

        if (shouldAnimate && buttonRef.current) {
          isAnimatingRef.current = true;
          animate(
            buttonRef.current,
            { backgroundColor: [baseColor, colors.highlight, baseColor] },
            { duration: PULSE_DURATION_MS / 1000, ease: ["easeOut", "easeIn"], times: [0, 0.3, 1] }
          ).then(() => {
            isAnimatingRef.current = false;
          });
        }
      }

      animationId = requestAnimationFrame(checkSelection);
    };

    animationId = requestAnimationFrame(checkSelection);
    return () => cancelAnimationFrame(animationId);
  }, [hour, isWorking, baseColor, colors.highlight, selectedBlockRef]);

  const handleClick = useCallback(() => {
    if (isWorking) {
      onClickRef.current?.(hour);
    }
  }, [hour, isWorking, onClickRef]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={buttonRef}
          type="button"
          onClick={handleClick}
          className={`h-full flex-1 cursor-[inherit] ${getRoundedCornerClass(hour)}`}
          style={{ backgroundColor: baseColor }}
        />
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className="font-medium tabular-nums">{formatHour(hour)}</span>
      </TooltipContent>
    </Tooltip>
  );
});

type MemberTimelineRowProps = {
  memberId: string;
  hours: boolean[];
  isDark: boolean;
  selectedBlockRef: React.RefObject<number | null>;
  onClickRef: React.RefObject<(hour: number) => void>;
};

const MemberTimelineRow = memo(function MemberTimelineRow({
  memberId,
  hours,
  isDark,
  selectedBlockRef,
  onClickRef,
}: MemberTimelineRowProps) {
  return (
    <div
      key={memberId}
      className="flex h-8 gap-px overflow-hidden rounded-lg bg-neutral-200 p-1 dark:bg-neutral-900"
    >
      {hours.map((isWorking, hour) => (
        <HourBlock
          key={hour}
          hour={hour}
          isWorking={isWorking}
          isDark={isDark}
          selectedBlockRef={selectedBlockRef}
          onClickRef={onClickRef}
        />
      ))}
    </div>
  );
});

type GroupHeaderProps = {
  group: TeamGroup;
  rowCount: number;
  isCollapsed: boolean;
  onToggle: () => void;
};

const GroupHeader = memo(function GroupHeader({
  group,
  rowCount,
  isCollapsed,
  onToggle,
}: GroupHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="-ml-1.5 flex items-center gap-2 rounded-md px-1.5 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
    >
      <ChevronRight
        className={`h-3 w-3 transition-transform duration-150 ${isCollapsed ? "" : "rotate-90"}`}
      />
      <span>{group.name}</span>
      <span className="text-neutral-500 dark:text-neutral-400">({rowCount})</span>
    </button>
  );
});

type OverlapStatusIconProps = {
  status: OverlapStatus;
};

const OverlapStatusIcon = memo(function OverlapStatusIcon({ status }: OverlapStatusIconProps) {
  const iconConfigs = {
    none: {
      bgClass: "bg-red-100 dark:bg-red-900/30",
      icon: X,
      iconClass: "text-red-600 dark:text-red-400",
    },
    partial: {
      bgClass: "bg-amber-100 dark:bg-amber-900/30",
      icon: Minus,
      iconClass: "text-amber-600 dark:text-amber-400",
    },
    full: {
      bgClass: "bg-emerald-100 dark:bg-emerald-900/30",
      icon: Check,
      iconClass: "text-emerald-600 dark:text-emerald-400",
    },
    mixed: {
      bgClass: "bg-emerald-100 dark:bg-emerald-900/30",
      icon: Check,
      iconClass: "text-emerald-600 dark:text-emerald-400",
    },
  } as const;

  const config = iconConfigs[status];
  const Icon = config.icon;

  return (
    <div
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${config.bgClass} sm:h-7 sm:w-7`}
    >
      <Icon className={`h-3 w-3 ${config.iconClass} sm:h-3.5 sm:w-3.5`} />
    </div>
  );
});

type FindMeetingTimeButtonProps = {
  onClick: () => void;
};

const FindMeetingTimeButton = memo(function FindMeetingTimeButton({
  onClick,
}: FindMeetingTimeButtonProps) {
  return (
    <Button
      variant="outline"
      type="button"
      className="group flex h-14 w-full items-center justify-center gap-2 border-2 border-dashed border-neutral-200 bg-neutral-50/50 text-neutral-600 hover:border-neutral-400 hover:bg-neutral-100/50 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/50"
      onClick={onClick}
    >
      <Clock className="h-5 w-5 transition-transform group-hover:scale-110" />
      <span className="font-medium">Find Best Meeting Time</span>
    </Button>
  );
});

// ============================================================================
// Main Component
// ============================================================================

const TimezoneVisualizer = ({
  members,
  groups = [],
  collapsedGroupIds = [],
  onToggleGroupCollapse,
}: TimezoneVisualizerProps) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // ---- Refs ----
  const sectionsContainerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const lineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveringRef = useRef(false);
  const selectedBlockRef = useRef<number | null>(null);
  const selectedTimeBlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Motion Values (for off-thread animations) ----
  const lineX = useMotionValue(0);
  const lineOpacity = useMotionValue(0);

  // ---- State ----
  const [isComparing, setIsComparing] = useState(false);
  const [compareSelections, setCompareSelections] = useState<Selection[]>([]);

  // ---- Memoized Values ----
  const collapsedSet = useMemo(() => new Set(collapsedGroupIds), [collapsedGroupIds]);

  const viewerTimezone = useClientValue(() => getUserTimezone(), "");

  const tick = useSyncExternalStore(tickSubscribe, getTickSnapshot, getTickServerSnapshot);

  const nowPosition = useMemo(() => {
    if (!viewerTimezone) return null;
    void tick; // Dependency for recalculation
    return getCurrentTimePosition(viewerTimezone);
  }, [viewerTimezone, tick]);

  const memberRows = useMemo((): MemberRow[] => {
    if (!viewerTimezone) return [];
    void tick; // Dependency for recalculation

    return members.map((member) => {
      const hours = [...EMPTY_HOURS];
      const startInViewerTz = convertHourToTimezone(
        member.workingHoursStart,
        member.timezone,
        viewerTimezone
      );
      const endInViewerTz = convertHourToTimezone(
        member.workingHoursEnd,
        member.timezone,
        viewerTimezone
      );

      if (startInViewerTz <= endInViewerTz) {
        for (let h = startInViewerTz; h < endInViewerTz; h++) {
          hours[h] = true;
        }
      } else {
        for (let h = startInViewerTz; h < HOURS_IN_DAY; h++) {
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

  const memberRowById = useMemo(
    () => new Map(memberRows.map((row) => [row.member.id, row])),
    [memberRows]
  );

  const groupNameById = useMemo(
    () => new Map(groups.map((group) => [group.id, group.name])),
    [groups]
  );

  const groupedSections = useMemo((): GroupedSection[] => {
    if (groups.length === 0) {
      return [{ group: null, rows: memberRows }];
    }

    const rowByMemberId = new Map(memberRows.map((row) => [row.member.id, row]));
    const sections: GroupedSection[] = [];

    const sortedGroups = [...groups].sort((a, b) => a.order - b.order);

    for (const group of sortedGroups) {
      const groupMembers = members.filter((m) => m.groupId === group.id);
      if (groupMembers.length === 0) continue;

      const rows = groupMembers
        .map((m) => rowByMemberId.get(m.id))
        .filter((row): row is MemberRow => row !== undefined);

      sections.push({ group, rows });
    }

    const ungroupedMembers = members.filter((m) => !m.groupId);
    if (ungroupedMembers.length > 0) {
      const rows = ungroupedMembers
        .map((m) => rowByMemberId.get(m.id))
        .filter((row): row is MemberRow => row !== undefined);

      sections.push({ group: null, rows });
    }

    return sections;
  }, [groups, members, memberRows]);

  const validSelections = useMemo(() => {
    return compareSelections.filter((sel) => {
      if (sel.type === "member") {
        return members.some((m) => m.id === sel.id);
      }
      return groups.some((g) => g.id === sel.id);
    });
  }, [compareSelections, members, groups]);

  const totalPeopleSelected = useMemo(() => {
    return validSelections.reduce((count, sel) => {
      if (sel.type === "member") return count + 1;
      return count + members.filter((m) => m.groupId === sel.id).length;
    }, 0);
  }, [validSelections, members]);

  const canShowOverlap = totalPeopleSelected >= 2;

  const { overlapHours, partialOverlapHours, crossTeamOverlapHours, overlapCounts } = useMemo((): OverlapData => {
    if (!canShowOverlap) return EMPTY_OVERLAP_DATA;

    const allMemberHours: boolean[][] = [];
    const selectionCoverage: boolean[][] = [];

    for (const sel of validSelections) {
      const selectionHours = Array.from({ length: HOURS_IN_DAY }, () => false);

      if (sel.type === "member") {
        const row = memberRowById.get(sel.id);
        if (row) {
          allMemberHours.push(row.hours);
          row.hours.forEach((isWorking, hour) => {
            if (isWorking) selectionHours[hour] = true;
          });
        }
      } else {
        const groupMembers = members.filter((m) => m.groupId === sel.id);
        for (const member of groupMembers) {
            const row = memberRowById.get(member.id);
            if (row) {
              allMemberHours.push(row.hours);
              row.hours.forEach((isWorking, hour) => {
                if (isWorking) selectionHours[hour] = true;
              });
            }
        }
      }

      selectionCoverage.push(selectionHours);
    }

    if (allMemberHours.length < 2) return EMPTY_OVERLAP_DATA;

    const totalPeople = allMemberHours.length;
    const counts = Array.from({ length: HOURS_IN_DAY }, (_, hour) =>
      allMemberHours.filter((hours) => hours[hour]).length
    );

    const full = counts.map((count) => count === totalPeople);
    const partial = counts.map((count, hour) => count >= 2 && !full[hour]);
    const crossTeam = counts.map((_, hour) => {
      if (selectionCoverage.length < 2) return false;
      return selectionCoverage.every((hours) => hours[hour]);
    });

    return {
      overlapHours: full,
      partialOverlapHours: partial,
      crossTeamOverlapHours: crossTeam,
      overlapCounts: counts,
    };
  }, [canShowOverlap, validSelections, memberRowById, members]);

  const overlapStatus = useMemo((): OverlapStatus => {
    const hasFullOverlap = overlapHours.some(Boolean);
    const hasPartialOverlap = partialOverlapHours.some(Boolean);

    if (!hasFullOverlap && !hasPartialOverlap) return "none";
    if (hasFullOverlap && hasPartialOverlap) return "mixed";
    if (hasFullOverlap) return "full";
    return "partial";
  }, [overlapHours, partialOverlapHours]);

  // ---- Callbacks ----
  const handleHourBlockClick = useCallback((hour: number) => {
    if (selectedTimeBlockTimeoutRef.current) {
      clearTimeout(selectedTimeBlockTimeoutRef.current);
      selectedTimeBlockTimeoutRef.current = null;
    }

    const newValue = selectedBlockRef.current === hour ? null : hour;
    selectedBlockRef.current = newValue;

    if (newValue !== null) {
      selectedTimeBlockTimeoutRef.current = setTimeout(() => {
        selectedBlockRef.current = null;
        selectedTimeBlockTimeoutRef.current = null;
      }, PULSE_DURATION_MS);
    }
  }, []);

  const handleHourBlockClickRef = useRef(handleHourBlockClick);
  useEffect(() => {
    handleHourBlockClickRef.current = handleHourBlockClick;
  }, [handleHourBlockClick]);

  const addSelection = useCallback((sel: Selection) => {
    setCompareSelections((prev) => {
      const key = serializeSelection(sel);
      if (prev.some((s) => serializeSelection(s) === key)) return prev;
      return [...prev, sel];
    });
  }, []);

  const removeSelection = useCallback((sel: Selection) => {
    setCompareSelections((prev) => {
      const key = serializeSelection(sel);
      return prev.filter((s) => serializeSelection(s) !== key);
    });
  }, []);

  const getSelectionName = useCallback(
    (sel: Selection): string => {
      if (sel.type === "member") {
        return members.find((m) => m.id === sel.id)?.name ?? "Unknown";
      }
      return groups.find((g) => g.id === sel.id)?.name ?? "Unknown";
    },
    [members, groups]
  );

  const isSelectionSelected = useCallback(
    (sel: Selection): boolean => {
      const key = serializeSelection(sel);
      return validSelections.some((s) => serializeSelection(s) === key);
    },
    [validSelections]
  );

  const getMembersForSelection = useCallback(
    (selection: Selection | null): TeamMember[] => {
      if (!selection) return [];
      if (selection.type === "member") {
        const member = members.find((m) => m.id === selection.id);
        return member ? [member] : [];
      }
      return members.filter((m) => m.groupId === selection.id);
    },
    [members]
  );

  const getMembersAvailabilityAtHour = useCallback(
    (hour: number): Map<string, { available: TeamMember[]; unavailable: TeamMember[] }> => {
      const result = new Map<string, { available: TeamMember[]; unavailable: TeamMember[] }>();

      for (const sel of validSelections) {
        const selMembers = getMembersForSelection(sel);
        const available: TeamMember[] = [];
        const unavailable: TeamMember[] = [];

        for (const m of selMembers) {
          const row = memberRows.find((r) => r.member.id === m.id);
          if (row?.hours[hour]) {
            available.push(m);
          } else {
            unavailable.push(m);
          }
        }

        result.set(serializeSelection(sel), { available, unavailable });
      }

      return result;
    },
    [validSelections, getMembersForSelection, memberRows]
  );

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

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current || !sectionsContainerRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const containerRect = sectionsContainerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - containerRect.left;

      lineX.set(relativeX);

      if (!isHoveringRef.current) {
        isHoveringRef.current = true;
        animate(lineOpacity, 1, { duration: 0.1 });
      }

      if (lineDebounceRef.current) {
        clearTimeout(lineDebounceRef.current);
      }

      lineDebounceRef.current = setTimeout(() => {
        animate(lineOpacity, 0, { duration: 0.2 });
      }, HOVER_HIDE_DELAY_MS);
    },
    [lineX, lineOpacity]
  );

  const handleMouseLeave = useCallback(() => {
    isHoveringRef.current = false;

    if (lineDebounceRef.current) {
      clearTimeout(lineDebounceRef.current);
      lineDebounceRef.current = null;
    }

    animate(lineOpacity, 0, { duration: 0.15 });
  }, [lineOpacity]);

  const closeComparePanel = useCallback(() => {
    setIsComparing(false);
    setCompareSelections([]);
  }, []);

  const openComparePanel = useCallback(() => {
    setIsComparing(true);
  }, []);

  // ---- Effects ----
  useEffect(() => {
    return () => {
      if (lineDebounceRef.current) {
        clearTimeout(lineDebounceRef.current);
      }
    };
  }, []);

  // ---- Early Returns ----
  if (members.length === 0 || !viewerTimezone) {
    return null;
  }

  // ---- Render Helpers ----
  const renderTimeAxis = () => (
    <div className="flex gap-2 sm:gap-3">
      <div className="w-8 shrink-0 sm:w-24" />
      <div className="flex flex-1 justify-between">
        {TIME_AXIS_HOURS.map((hour, index, arr) => {
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
                {formatHour(hour % HOURS_IN_DAY)}
              </span>
              <div className="mt-1 h-1.5 w-px bg-neutral-300 dark:bg-neutral-600" />
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderCurrentTimeIndicator = () => {
    if (nowPosition === null) return null;

    return (
      <>
        {/* Mobile */}
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 rounded-full bg-red-500 shadow-sm sm:hidden"
          style={{ left: `calc(2.5rem + (100% - 2.5rem) * ${nowPosition / 100})` }}
        >
          <div className="absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-red-500" />
        </div>
        {/* Desktop */}
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-20 hidden w-0.5 rounded-full bg-red-500 shadow-sm sm:block"
          style={{ left: `calc(6.75rem + (100% - 6.75rem) * ${nowPosition / 100})` }}
        >
          <div className="absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-red-500" />
        </div>
      </>
    );
  };

  const renderMemberAvatar = (member: TeamMember, dayOffset: number, isSelected: boolean) => {
    const dayOffsetLabel = formatDayOffset(dayOffset);

    const content = (
      <div className="flex h-8 items-center justify-center sm:justify-start sm:gap-2">
        <div className="relative">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900 sm:h-7 sm:w-7 sm:text-xs"
            title={member.name}
          >
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
        <span
          className="hidden truncate text-sm font-medium text-neutral-700 dark:text-neutral-300 sm:block"
          title={member.name}
        >
          {member.name}
        </span>
      </div>
    );

    if (dayOffsetLabel) {
      return (
        <Tooltip key={member.id}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="left">
            <span>{dayOffsetLabel}</span>
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div key={member.id}>{content}</div>;
  };

  const renderOverlapBar = () => {
    return (
      <div className="flex h-8 gap-px overflow-hidden rounded-lg bg-neutral-200 p-1 dark:bg-neutral-900">
        {Array.from({ length: HOURS_IN_DAY }, (_, hour) => {
          const isFullOverlap = overlapHours[hour];
          const isCrossTeamOverlap = crossTeamOverlapHours[hour];
          const isPartialOverlap = partialOverlapHours[hour];
          const hasAnyOverlap = isFullOverlap || isPartialOverlap || isCrossTeamOverlap;

          const colorClass = isFullOverlap
            ? "bg-emerald-500 dark:bg-emerald-400"
            : isCrossTeamOverlap
              ? "bg-sky-500 dark:bg-sky-400"
              : isPartialOverlap
                ? "bg-amber-500 dark:bg-amber-400"
                : "bg-neutral-300 dark:bg-neutral-700";

          if (!hasAnyOverlap) {
            return (
              <Tooltip key={hour}>
                <TooltipTrigger asChild>
                  <div
                    className={`h-6 flex-1 bg-neutral-300 dark:bg-neutral-700 ${getRoundedCornerClass(hour)}`}
                  />
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="font-medium tabular-nums">{formatHour(hour)}</div>
                </TooltipContent>
              </Tooltip>
            );
          }

          const availabilityMap = getMembersAvailabilityAtHour(hour);
          const overlapLabel = isFullOverlap
            ? `All ${totalPeopleSelected} available`
            : isCrossTeamOverlap
              ? "Each team represented"
              : `${overlapCounts[hour]} of ${totalPeopleSelected} available`;

          // Collect all available and unavailable members across selections
          const allAvailable: TeamMember[] = [];
          const allUnavailable: TeamMember[] = [];
          for (const sel of validSelections) {
            const data = availabilityMap.get(serializeSelection(sel));
            if (data) {
              allAvailable.push(...data.available);
              allUnavailable.push(...data.unavailable);
            }
          }

          const bucketByTeam = (list: TeamMember[]) => {
            const buckets = new Map<string, string[]>();
            for (const member of list) {
              const key = member.groupId ? groupNameById.get(member.groupId) ?? "Team" : "Ungrouped";
              const names = buckets.get(key) ?? [];
              names.push(member.name);
              buckets.set(key, names);
            }
            return buckets;
          };

          const availableByTeam = bucketByTeam(allAvailable);
          const unavailableByTeam = bucketByTeam(allUnavailable);

          // Identify teams where no one is available (entire team unavailable)
          const fullyUnavailableTeams = Array.from(unavailableByTeam.keys()).filter(
            (teamName) => !availableByTeam.has(teamName)
          );
          // Teams with some members available and some unavailable
          const partiallyUnavailableTeams = Array.from(unavailableByTeam.entries()).filter(
            ([teamName]) => availableByTeam.has(teamName)
          );

          return (
            <Tooltip key={hour}>
              <TooltipTrigger asChild>
                <div className={`h-6 flex-1 ${getRoundedCornerClass(hour)} ${colorClass}`} />
              </TooltipTrigger>
              <TooltipContent side="top">
                <div className="font-medium tabular-nums text-neutral-900 dark:text-neutral-50">
                  {formatHour(hour)}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  {overlapLabel}
                </div>
                {availableByTeam.size > 0 && (
                  <div className="mt-1.5 mb-3 flex flex-col gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                      Available by team
                    </span>
                    {Array.from(availableByTeam.entries()).map(([teamName, names]) => (
                      <div key={`${teamName}-available`} className="flex items-center justify-between gap-4 text-xs">
                        <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">{teamName}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 truncate">{names.join(", ")}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!isFullOverlap && unavailableByTeam.size > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-red-600 dark:text-red-400">
                      Unavailable
                    </span>
                    {/* Teams with no one available - shown with strikethrough */}
                    {fullyUnavailableTeams.map((teamName) => (
                      <div
                        key={`${teamName}-fully-unavailable`}
                        className="flex items-center justify-between gap-4 text-xs text-neutral-400 dark:text-neutral-500"
                      >
                        <span className="font-medium line-through truncate">{teamName}</span>
                        <span className="truncate">
                          {unavailableByTeam.get(teamName)?.join(", ")}
                        </span>
                      </div>
                    ))}
                    {/* Teams with some members unavailable */}
                    {partiallyUnavailableTeams.map(([teamName, names]) => (
                      <div
                        key={`${teamName}-unavailable`}
                        className="flex items-center justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-400"
                      >
                        <span className="font-medium text-neutral-700 dark:text-neutral-300 truncate">{teamName}</span>
                        <span className="truncate">{names.join(", ")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  };

  const renderOverlapSummary = () => {
    const anyOverlap = overlapHours.map((full, i) => full || partialOverlapHours[i]);
    const start = anyOverlap.findIndex(Boolean);
    const end = anyOverlap.lastIndexOf(true);

    if (start === -1 || end === -1) return null;

    const fullHoursCount = overlapHours.filter(Boolean).length;
    const partialHoursCount = partialOverlapHours.filter(Boolean).length;
    const endExclusive = end + 1;

    return (
      <span>
        {formatHour(start)} – {formatHour(endExclusive % HOURS_IN_DAY)}
        <span className="ml-1">
          ({fullHoursCount}h full{partialHoursCount > 0 ? `, ${partialHoursCount}h partial` : ""})
        </span>
      </span>
    );
  };

  const renderLegend = () => {
    const hasCrossTeamOverlap = crossTeamOverlapHours.some(Boolean);

    return (
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
            {hasCrossTeamOverlap && (
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-sky-500 dark:bg-sky-400" />
                <span>Each team represented</span>
              </div>
            )}
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
    );
  };

  // ---- Main Render ----
  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex flex-col gap-6">
        {renderTimeAxis()}

        <div ref={sectionsContainerRef} className="relative flex flex-col gap-4">
          {renderCurrentTimeIndicator()}

          <motion.div
            className="pointer-events-none absolute inset-y-0 z-30 w-px bg-neutral-400/60 dark:bg-neutral-500/60"
            style={{ left: lineX, opacity: lineOpacity }}
          />

          {groupedSections.map((section, sectionIndex) => {
            const isCollapsed = section.group ? collapsedSet.has(section.group.id) : false;
            const visibleRows = isCollapsed ? [] : section.rows;

            return (
              <div key={section.group?.id ?? "ungrouped"} className="flex flex-col gap-3">
                {section.group && (
                  <GroupHeader
                    group={section.group}
                    rowCount={section.rows.length}
                    isCollapsed={isCollapsed}
                    onToggle={() => onToggleGroupCollapse?.(section.group!.id)}
                  />
                )}

                {!section.group && groups.length > 0 && (
                  <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    <span>Ungrouped</span>
                    <span>({section.rows.length})</span>
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {visibleRows.length > 0 && (
                    <motion.div
                      key={`section-${section.group?.id ?? "ungrouped"}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-stretch gap-2 sm:gap-3">
                        <div className="flex w-8 shrink-0 flex-col gap-3 sm:w-24">
                          {visibleRows.map(({ member, dayOffset }) =>
                            renderMemberAvatar(member, dayOffset, isMemberInCompare(member.id))
                          )}
                        </div>

                        <div
                          ref={sectionIndex === 0 ? timelineRef : undefined}
                          className="relative flex-1 cursor-crosshair"
                          onMouseMove={handleMouseMove}
                          onMouseLeave={handleMouseLeave}
                        >
                          <div className="flex flex-col gap-3">
                            {visibleRows.map(({ member, hours }) => (
                              <MemberTimelineRow
                                key={member.id}
                                memberId={member.id}
                                hours={hours}
                                isDark={isDark}
                                selectedBlockRef={selectedBlockRef}
                                onClickRef={handleHourBlockClickRef}
                              />
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
                <FindMeetingTimeButton onClick={openComparePanel} />
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
                      onClick={closeComparePanel}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

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
                              </SelectItem>
                            );
                          })}
                        </SelectGroup>
                        {groups.filter((g) => members.some((m) => m.groupId === g.id)).length >
                          0 && (
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
                                  </SelectItem>
                                );
                              })}
                            </SelectGroup>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {canShowOverlap && (
                    <div className="flex flex-col gap-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                      <p className="text-right text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                        {renderOverlapSummary()}
                      </p>

                      <div className="flex items-stretch gap-2 sm:gap-3">
                        <div className="flex w-8 shrink-0 flex-col sm:w-24">
                          <div className="flex h-8 items-center justify-center sm:justify-start sm:gap-2">
                            <OverlapStatusIcon status={overlapStatus} />
                            <span className="hidden truncate text-sm font-medium text-neutral-700 dark:text-neutral-300 sm:block">
                              {overlapStatus === "none" ? "No overlap" : "Overlap"}
                            </span>
                          </div>
                        </div>

                        <div className="flex-1">{renderOverlapBar()}</div>
                      </div>

                      {/* Time axis for overlap visualization */}
                      <div className="flex gap-2 sm:gap-3">
                        <div className="w-8 shrink-0 sm:w-24" />
                        <div className="flex flex-1 justify-between">
                          {TIME_AXIS_HOURS.map((hour, index, arr) => {
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
                                <div className="mb-1 h-1.5 w-px bg-neutral-300 dark:bg-neutral-600" />
                                <span className="whitespace-nowrap text-[10px] tabular-nums text-neutral-600 dark:text-neutral-400 sm:text-xs">
                                  {formatHour(hour % HOURS_IN_DAY)}
                                </span>
                              </div>
                            );
                          })}
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

        {renderLegend()}
      </div>
    </TooltipProvider>
  );
};

export { TimezoneVisualizer };
