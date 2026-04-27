"use client";

import { Button } from "@repo/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import { Check, ChevronRight, Clock, Minus, X } from "lucide-react";

import { convertHourToTimezone, formatTimezoneAbbreviation } from "@/lib/timezones";
import { cn, formatHour } from "@/lib/utils";
import type { TeamGroup } from "@/types";

import { HOURS_IN_DAY, getRoundedCornerClass } from "./helpers";
import type { OverlapStatus } from "./types";

type HourBlockProps = {
  hour: number;
  isDark: boolean;
  isWorking: boolean;
  memberTimezone: string;
  viewerTimezone: string;
};

const HourBlock = ({ hour, isWorking, memberTimezone, viewerTimezone }: HourBlockProps) => {
  // Convert the displayed hour (in viewer's timezone) back to member's local time
  const memberHour = convertHourToTimezone(hour, viewerTimezone, memberTimezone);
  const memberNextHour = (memberHour + 1) % HOURS_IN_DAY;
  const memberTzAbbrev = formatTimezoneAbbreviation(memberTimezone);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            className={cn(
              `h-full flex-1 cursor-[inherit] ${getRoundedCornerClass(hour)}`,
              isWorking
                ? "bg-foreground/80 dark:bg-accent-foreground"
                : "bg-accent transition-colors hover:bg-muted",
            )}
            type="button"
          />
        }
      />

      <TooltipContent side="top">
        <div className="flex flex-col gap-1">
          <span className="font-medium tabular-nums">
            {formatHour(hour)} – {formatHour((hour + 1) % HOURS_IN_DAY)}
          </span>
          <span className="text-xs text-background/70 tabular-nums">
            {formatHour(memberHour)} – {formatHour(memberNextHour)} {memberTzAbbrev}
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

type MemberTimelineRowProps = {
  hours: Array<boolean>;
  isDark: boolean;
  memberId: string;
  memberTimezone: string;
  selectedBlockRef: React.RefObject<number | null>;
  viewerTimezone: string;
};

const MemberTimelineRow = ({
  hours,
  isDark,
  memberId,
  memberTimezone,
  viewerTimezone,
}: MemberTimelineRowProps) => (
  <div className="flex h-8 gap-px overflow-hidden rounded-lg bg-secondary p-1" key={memberId}>
    {hours.map((isWorking, hour) => (
      <HourBlock
        hour={hour}
        isDark={isDark}
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
    className="-ml-1.5 flex items-center gap-2 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    onClick={onToggle}
    type="button"
  >
    <ChevronRight
      className={`h-3 w-3 transition-transform duration-150 ${isCollapsed ? "" : "rotate-90"}`}
    />
    <span>{group.name}</span>
    <span className="text-muted-foreground">({rowCount})</span>
  </button>
);

type OverlapStatusIconProps = {
  status: OverlapStatus;
};

// Hoisted to module scope: identity is stable across renders.
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
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${config.bgClass} sm:h-7 sm:w-7`}
    >
      <Icon className={`h-3 w-3 ${config.iconClass} sm:h-3.5 sm:w-3.5`} />
    </div>
  );
};

type FindMeetingTimeButtonProps = {
  onClick: () => void;
};

const FindMeetingTimeButton = ({ onClick }: FindMeetingTimeButtonProps) => (
  <Button
    className="group flex h-14 w-full items-center justify-center gap-2 border-2 border-dashed border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground hover:bg-muted"
    onClick={onClick}
    type="button"
    variant="outline"
  >
    <Clock className="h-5 w-5 transition-transform group-hover:scale-110" />
    <span className="font-medium">Find Best Meeting Time</span>
  </Button>
);

export { FindMeetingTimeButton, GroupHeader, MemberTimelineRow, OverlapStatusIcon };
