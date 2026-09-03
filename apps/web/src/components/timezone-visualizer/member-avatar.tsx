"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";

import type { TeamMember } from "@/types";

import { formatDayOffset } from "./helpers";

type MemberAvatarProps = {
  dayOffset: number;
  isSelected: boolean;
  member: TeamMember;
  totalMembers: number;
};

const MemberAvatar = ({ dayOffset, isSelected, member, totalMembers }: MemberAvatarProps) => {
  const dayOffsetLabel = formatDayOffset(dayOffset);
  const hasDayOffset = dayOffsetLabel !== null && dayOffsetLabel !== "";

  const content = (
    <div
      className={`flex h-8 items-center justify-start gap-1.5 sm:gap-2 ${hasDayOffset ? "cursor-help" : ""}`}
    >
      <div className="relative">
        <div
          className="flex size-6 shrink-0 items-center justify-center border border-border bg-secondary text-[0.6875rem] font-semibold text-secondary-foreground sm:size-7 sm:text-xs"
          title={member.name}
        >
          {member.name.charAt(0).toUpperCase()}
        </div>
        {isSelected && totalMembers > 1 && (
          <div className="absolute -top-0.5 -right-0.5 size-2.5 border-2 border-background bg-foreground sm:h-3 sm:w-3" />
        )}
        {dayOffset !== 0 && (
          <div className="absolute -right-1 -bottom-0.5 flex size-4 items-center justify-center bg-warning font-mono text-[0.625rem] font-bold text-warning-foreground sm:size-5 sm:text-xs">
            {dayOffset > 0 ? `+${dayOffset}` : dayOffset}
          </div>
        )}
      </div>
      <span
        className="block truncate text-xs font-medium text-foreground sm:text-sm"
        title={member.name}
      >
        {member.name}
      </span>
    </div>
  );

  if (hasDayOffset) {
    return (
      <Tooltip>
        <TooltipTrigger render={<div />}>{content}</TooltipTrigger>
        <TooltipContent side="left">
          <span>{dayOffsetLabel}</span>
        </TooltipContent>
      </Tooltip>
    );
  }

  return <div>{content}</div>;
};

export { MemberAvatar };
