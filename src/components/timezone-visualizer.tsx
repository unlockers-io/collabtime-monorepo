"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { TeamMember } from "@/types";
import { convertHourToTimezone, getUserTimezone } from "@/lib/timezones";
import { formatHour } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TimezoneVisualizerProps = {
  members: TeamMember[];
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

const TimezoneVisualizer = ({ members }: TimezoneVisualizerProps) => {
  const [selectedAId, setSelectedAId] = useState<string | null>(
    () => members[0]?.id ?? null,
  );
  const [selectedBId, setSelectedBId] = useState<string | null>(() => {
    const first = members[0]?.id;
    return members.find((m) => m.id !== first)?.id ?? null;
  });
  const [hoverInfo, setHoverInfo] = useState<{ x: number; hour: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const [activeAId, activeBId] = useMemo(() => {
    const ids = members.map((m) => m.id);
    const aValid =
      selectedAId && ids.includes(selectedAId) ? selectedAId : (ids[0] ?? null);
    let bValid =
      selectedBId && ids.includes(selectedBId) && selectedBId !== aValid
        ? selectedBId
        : (ids.find((id) => id !== aValid) ?? null);
    if (bValid === aValid) {
      bValid = ids.find((id) => id !== aValid) ?? null;
    }
    return [aValid, bValid];
  }, [members, selectedAId, selectedBId]);

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

  const selectedRowA = useMemo(
    () => memberRows.find((row) => row.member.id === activeAId),
    [memberRows, activeAId],
  );

  const selectedRowB = useMemo(
    () => memberRows.find((row) => row.member.id === activeBId),
    [memberRows, activeBId],
  );

  const selectedAHours = selectedRowA?.hours ?? new Array(24).fill(false);
  const selectedBHours = selectedRowB?.hours ?? new Array(24).fill(false);

  // Calculate overlap hours between selected pair
  const overlapHours = useMemo(() => {
    if (!selectedRowA || !selectedRowB) return new Array(24).fill(false);
    return new Array(24)
      .fill(false)
      .map((_, hour) => selectedAHours[hour] && selectedBHours[hour]);
  }, [selectedRowA, selectedRowB, selectedAHours, selectedBHours]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const hour = Math.floor(percentage * 24);
    const clampedHour = Math.max(0, Math.min(23, hour));
    setHoverInfo({ x, hour: clampedHour });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverInfo(null);
  }, []);

  if (members.length === 0 || !viewerTimezone) {
    return null;
  }

  return (
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

      {/* Member rows with shared current time indicator */}
      <div className="flex items-stretch gap-2 sm:gap-3">
        {/* Names column */}
        <div className="flex w-8 shrink-0 flex-col gap-3 sm:w-24">
          {memberRows.map(({ member }, index) => {
            const isSelected = member.id === activeAId || member.id === activeBId;
            return (
              <motion.div
                key={member.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                  delay: index * 0.05,
                }}
                className="flex h-8 items-center justify-center sm:justify-start sm:gap-2"
              >
                <div className="relative">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900 sm:h-7 sm:w-7 sm:text-xs">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <AnimatePresence>
                    {isSelected && members.length > 1 && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-50 bg-neutral-900 dark:border-neutral-900 dark:bg-neutral-50 sm:h-3 sm:w-3"
                      />
                    )}
                  </AnimatePresence>
                </div>
                <span className="hidden truncate text-sm font-medium text-neutral-700 dark:text-neutral-300 sm:block">
                  {member.name}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Timeline container with single current time indicator */}
        <div
          ref={timelineRef}
          className="relative flex-1 cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Hover indicator line - spans all rows */}
          {hoverInfo !== null && (
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-neutral-400/50 dark:bg-neutral-500/50"
              style={{ left: `${hoverInfo.x}px` }}
            />
          )}

          {/* Hover tooltip */}
          {hoverInfo !== null && (
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

          {/* Current time indicator - spans all rows */}
          {nowPosition !== null && (
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 rounded-full bg-red-500 shadow-sm"
              style={{ left: `${nowPosition}%` }}
            >
              <div className="absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-red-500" />
            </div>
          )}

          {/* Hour bars */}
          <div className="flex flex-col gap-3">
            {memberRows.map(({ member, hours }, index) => (
              <motion.div
                key={member.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                  delay: index * 0.05,
                }}
                className="flex h-8 gap-px overflow-hidden rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800"
              >
                {hours.map((isWorking, hour) => {
                  const overlapsWithSelected =
                    activeAId &&
                    activeBId &&
                    [activeAId, activeBId].includes(member.id) &&
                    overlapHours[hour];
                  return (
                    <div
                      key={hour}
                      className={`relative h-full flex-1 transition-colors ${
                        hour === 0 ? "rounded-l" : hour === 23 ? "rounded-r" : ""
                      } ${
                        isWorking
                          ? "bg-neutral-900 dark:bg-neutral-100"
                          : "bg-neutral-200/50 dark:bg-neutral-700/50"
                      }`}
                    >
                      {overlapsWithSelected && (
                        <span className="absolute inset-0 bg-emerald-400/50 mix-blend-screen dark:bg-emerald-300/40" />
                      )}
                    </div>
                  );
                })}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Overlap indicator */}
      {members.length > 1 && (
        <div className="flex flex-col gap-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
              <Select value={activeAId ?? ""} onValueChange={setSelectedAId}>
                <SelectTrigger className="h-9 w-full sm:w-auto sm:min-w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members
                    .filter(
                      (member) =>
                        member.id === activeAId || member.id !== activeBId
                    )
                    .map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select value={activeBId ?? ""} onValueChange={setSelectedBId}>
                <SelectTrigger className="h-9 w-full sm:w-auto sm:min-w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members
                    .filter(
                      (member) =>
                        member.id === activeBId || member.id !== activeAId
                    )
                    .map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-600 dark:text-neutral-400 sm:h-[14px] sm:w-[14px]"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <span className="hidden text-sm font-medium text-neutral-700 dark:text-neutral-300 sm:block">
                Overlap
              </span>
            </div>

            <div className="relative flex flex-1 gap-px overflow-hidden rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
              {overlapHours.map((isOverlap, hour) => (
                <div
                  key={hour}
                  className={`h-6 flex-1 transition-colors ${
                    hour === 0 ? "rounded-l" : hour === 23 ? "rounded-r" : ""
                  } ${
                    isOverlap
                      ? "bg-neutral-600 dark:bg-neutral-400"
                      : "bg-neutral-200/50 dark:bg-neutral-700/50"
                  }`}
                  title={`${formatHour(hour)} - ${isOverlap ? "Everyone available" : "Not everyone available"}`}
                />
              ))}
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
  );
};

export { TimezoneVisualizer };
