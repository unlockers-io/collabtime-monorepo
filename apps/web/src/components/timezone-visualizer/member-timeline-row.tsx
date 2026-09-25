"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { ChevronRight } from "lucide-react";

import {
  formatMinuteRange,
  formatTimezoneCity,
  formatUtcOffset,
  getOffsetMinutes,
} from "@/lib/timezones";
import type { TeamGroup } from "@/types";

import { HOURS_IN_DAY, formatDayOffset } from "./helpers";
import { SLOTS_PER_HOUR } from "./timezone-data";
import type { MemberRow } from "./types";

const HOURS = Array.from({ length: HOURS_IN_DAY }, (_, hour) => hour);
const QUARTERS = Array.from({ length: SLOTS_PER_HOUR }, (_, quarter) => quarter);

const getSlotClass = (isWorking: boolean, isBest: boolean, isCounted: boolean): string => {
  if (!isCounted) {
    return isWorking ? "bg-foreground/25" : "bg-muted/40";
  }
  if (isBest) {
    return isWorking ? "bg-foreground" : "bg-foreground/15";
  }
  return isWorking ? "bg-foreground/55" : "bg-muted/50";
};

type HourCellProps = {
  bestSlots: ReadonlyArray<boolean>;
  city: string;
  hour: number;
  memberShiftMinutes: number;
  row: MemberRow;
};

const HourCell = ({ bestSlots, city, hour, memberShiftMinutes, row }: HourCellProps) => {
  const startMinute = hour * 60;

  return (
    <Tooltip>
      <TooltipTrigger render={<div className="flex h-full flex-1" />}>
        {QUARTERS.map((quarter) => {
          const slot = hour * SLOTS_PER_HOUR + quarter;
          return (
            <span
              className={cn(
                "h-full flex-1",
                getSlotClass(row.slots[slot] ?? false, bestSlots[slot] ?? false, row.isCounted),
              )}
              key={quarter}
            />
          );
        })}
      </TooltipTrigger>
      <TooltipContent side="top">
        <div className="flex flex-col gap-1">
          <span className="font-mono font-medium tabular-nums">
            {formatMinuteRange(startMinute, startMinute + 60)} your time
          </span>
          {memberShiftMinutes !== 0 && (
            <span className="font-mono text-xs text-background/70 tabular-nums">
              {formatMinuteRange(
                startMinute + memberShiftMinutes,
                startMinute + memberShiftMinutes + 60,
              )}{" "}
              in {city}
            </span>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

type MemberTimelineRowProps = {
  bestSlots: ReadonlyArray<boolean>;
  isInBestWindow: boolean;
  onToggleCounted: (memberId: string) => void;
  row: MemberRow;
  viewerTimezone: string;
};

const describeRow = (
  row: MemberRow,
  isInBestWindow: boolean,
  hasBestWindow: boolean,
  viewerTimezone: string,
): string => {
  const { interval, member } = row;
  const yourTime = formatMinuteRange(
    interval.startMinute,
    interval.startMinute + interval.lengthMinutes,
  );
  const localTime = formatMinuteRange(member.workingHoursStart * 60, member.workingHoursEnd * 60);
  const parts = [
    `Works ${yourTime} your time (${localTime} in ${formatTimezoneCity(member.timezone)}, ${formatUtcOffset(member.timezone)}).`,
  ];
  const dayOffset = formatDayOffset(row.dayOffset);
  if (dayOffset !== null) {
    parts.push(`Their date is ${dayOffset}.`);
  }
  if (!row.isCounted) {
    parts.push("Not counted in the best window.");
  } else if (hasBestWindow) {
    parts.push(isInBestWindow ? "Working during the best window." : "Off during the best window.");
  }
  if (viewerTimezone === member.timezone) {
    parts.push("Same timezone as you.");
  }
  return parts.join(" ");
};

const MemberTimelineRow = ({
  bestSlots,
  isInBestWindow,
  onToggleCounted,
  row,
  viewerTimezone,
}: MemberTimelineRowProps) => {
  const { dayOffset, isCounted, member } = row;
  const descriptionId = `tz-row-${member.id}`;
  const dayOffsetLabel = formatDayOffset(dayOffset);
  const memberShiftMinutes = getOffsetMinutes(member.timezone) - getOffsetMinutes(viewerTimezone);
  const city = formatTimezoneCity(member.timezone);
  const hasBestWindow = bestSlots.some(Boolean);

  return (
    <div className="flex h-8 items-center gap-2 sm:gap-3">
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              aria-describedby={descriptionId}
              aria-label={member.name}
              aria-pressed={isCounted}
              className="group/name flex h-8 w-28 shrink-0 items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-40 sm:gap-2.5"
              onClick={() => {
                onToggleCounted(member.id);
              }}
              type="button"
            />
          }
        >
          <span
            className={cn(
              "relative flex size-6 shrink-0 items-center justify-center border text-(length:--text-caption-xs) font-semibold sm:size-7 sm:text-xs",
              isCounted
                ? "border-border bg-secondary text-secondary-foreground"
                : "border-dashed border-muted-foreground/60 text-muted-foreground",
            )}
          >
            {member.name.charAt(0).toUpperCase()}
            {dayOffset !== 0 && (
              <span className="absolute -right-1 -bottom-1 flex h-3.5 min-w-3.5 items-center justify-center bg-foreground px-0.5 font-mono text-(length:--text-micro) font-bold text-background">
                {dayOffset > 0 ? `+${dayOffset}` : dayOffset}
              </span>
            )}
          </span>
          <span
            className={cn(
              "block truncate text-xs font-medium sm:text-sm",
              isCounted
                ? "text-foreground group-hover/name:underline"
                : "text-muted-foreground group-hover/name:text-foreground",
            )}
          >
            {member.name}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          <div className="flex flex-col gap-1">
            <span>{isCounted ? "Leave out of the best window" : "Count in the best window"}</span>
            {dayOffsetLabel !== null && (
              <span className="text-background/70">Their date is {dayOffsetLabel}</span>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
      <span className="sr-only" id={descriptionId}>
        {describeRow(row, isInBestWindow, hasBestWindow, viewerTimezone)}
      </span>

      <div aria-hidden className="flex h-8 flex-1 gap-px">
        {HOURS.map((hour) => (
          <HourCell
            bestSlots={bestSlots}
            city={city}
            hour={hour}
            key={hour}
            memberShiftMinutes={memberShiftMinutes}
            row={row}
          />
        ))}
      </div>
    </div>
  );
};

type GroupHeaderProps = {
  group: TeamGroup;
  isCollapsed: boolean;
  onToggle: () => void;
  rowCount: number;
};

const GroupHeader = ({ group, isCollapsed, onToggle, rowCount }: GroupHeaderProps) => (
  <button
    aria-controls={`tz-group-${group.id}`}
    aria-expanded={!isCollapsed}
    className="-ml-1.5 flex w-fit items-center gap-2 rounded-sm px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    onClick={onToggle}
    type="button"
  >
    <ChevronRight
      className={cn("size-3 transition-transform duration-150", !isCollapsed && "rotate-90")}
    />
    <span>{group.name}</span>
    <span className="font-mono tabular-nums">{rowCount}</span>
    {isCollapsed && <span>· hidden and not counted</span>}
  </button>
);

export { GroupHeader, MemberTimelineRow };
