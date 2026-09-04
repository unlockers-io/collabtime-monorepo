"use client";

import { Button } from "@repo/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import { Check, ChevronRight, Clock, Minus, X } from "lucide-react";

import { convertHourToTimezone, formatTimezoneAbbreviation } from "@/lib/timezones";
import { cn, formatHour } from "@/lib/utils";
import type { TeamGroup } from "@/types";

import { HOURS_IN_DAY } from "./helpers";
import type { OverlapStatus } from "./types";

type HourBlockProps = {
  hour: number;
  isSharedOverlap: boolean;
  isWorking: boolean;
  memberTimezone: string;
  viewerTimezone: string;
};

const getHourColorClass = (isSharedOverlap: boolean, isWorking: boolean): string => {
  if (isSharedOverlap) {
    return isWorking ? "bg-foreground" : "bg-foreground/15";
  }

  return isWorking ? "bg-foreground/55" : "bg-muted/50 transition-colors hover:bg-muted";
};

const HourBlock = ({
  hour,
  isSharedOverlap,
  isWorking,
  memberTimezone,
  viewerTimezone,
}: HourBlockProps) => {
  const memberHour = convertHourToTimezone(hour, viewerTimezone, memberTimezone);
  const memberNextHour = (memberHour + 1) % HOURS_IN_DAY;
  const memberTzAbbrev = formatTimezoneAbbreviation(memberTimezone);

  const hourLabel = `${formatHour(hour)} – ${formatHour((hour + 1) % HOURS_IN_DAY)} (${formatHour(memberHour)} – ${formatHour(memberNextHour)} ${memberTzAbbrev})`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            aria-label={hourLabel}
            className={cn(
              "h-full flex-1 cursor-[inherit]",
              getHourColorClass(isSharedOverlap, isWorking),
            )}
            type="button"
          />
        }
      />

      <TooltipContent side="top">
        <div className="flex flex-col gap-1">
          <span className="font-mono font-medium tabular-nums">
            {formatHour(hour)} – {formatHour((hour + 1) % HOURS_IN_DAY)}
          </span>
          <span className="font-mono text-xs text-background/70 tabular-nums">
            {formatHour(memberHour)} – {formatHour(memberNextHour)} {memberTzAbbrev}
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

type MemberTimelineRowProps = {
  hours: Array<boolean>;
  memberId: string;
  memberTimezone: string;
  sharedOverlapHours: ReadonlyArray<boolean>;
  viewerTimezone: string;
};

const MemberTimelineRow = ({
  hours,
  memberId,
  memberTimezone,
  sharedOverlapHours,
  viewerTimezone,
}: MemberTimelineRowProps) => (
  <div className="flex h-8 gap-px overflow-hidden bg-transparent" key={memberId}>
    {hours.map((isWorking, hour) => (
      <HourBlock
        hour={hour}
        isSharedOverlap={sharedOverlapHours[hour] ?? false}
        isWorking={isWorking}
        key={hour}
        memberTimezone={memberTimezone}
        viewerTimezone={viewerTimezone}
      />
    ))}
  </div>
);

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
    className="-ml-1.5 flex items-center gap-2 px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    onClick={onToggle}
    type="button"
  >
    <ChevronRight
      className={`size-3 transition-transform duration-150 ${isCollapsed ? "" : "rotate-90"}`}
    />
    <span>{group.name}</span>
    <span className="text-muted-foreground">({rowCount})</span>
  </button>
);

type OverlapStatusIconProps = {
  status: OverlapStatus;
};

const ICON_CONFIGS = {
  full: { bgClass: "bg-success/20", icon: Check, iconClass: "text-success" },
  mixed: { bgClass: "bg-success/20", icon: Check, iconClass: "text-success" },
  none: { bgClass: "bg-destructive/15", icon: X, iconClass: "text-destructive" },
  partial: { bgClass: "bg-warning/20", icon: Minus, iconClass: "text-warning" },
} as const;

const OverlapStatusIcon = ({ status }: OverlapStatusIconProps) => {
  const config = ICON_CONFIGS[status];
  const Icon = config.icon;

  return (
    <div
      className={`flex size-6 shrink-0 items-center justify-center ${config.bgClass} sm:h-7 sm:w-7`}
    >
      <Icon className={`size-3 ${config.iconClass} sm:h-3.5 sm:w-3.5`} />
    </div>
  );
};

type FindMeetingTimeButtonProps = {
  onClick: () => void;
};

const FindMeetingTimeButton = ({ onClick }: FindMeetingTimeButtonProps) => (
  <Button
    className="group flex h-14 w-full items-center justify-center gap-2 border-y border-dashed border-border bg-transparent text-muted-foreground hover:border-muted-foreground hover:bg-muted/50"
    onClick={onClick}
    type="button"
    variant="outline"
  >
    <Clock className="size-5 transition-transform group-hover:scale-110" />
    <span className="font-medium">Find Best Meeting Time</span>
  </Button>
);

export { FindMeetingTimeButton, GroupHeader, MemberTimelineRow, OverlapStatusIcon };
