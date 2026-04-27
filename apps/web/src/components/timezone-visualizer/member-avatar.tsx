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

  const content = (
    <div
      className={`flex h-8 items-center justify-center sm:justify-start sm:gap-2 ${dayOffsetLabel ? "cursor-help" : ""}`}
    >
      <div className="relative">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground sm:h-7 sm:w-7 sm:text-xs"
          title={member.name}
        >
          {member.name.charAt(0).toUpperCase()}
        </div>
        {isSelected && totalMembers > 1 && (
          <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-foreground sm:h-3 sm:w-3" />
        )}
        {dayOffset !== 0 && (
          <div className="absolute -right-1 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-warning text-[8px] font-bold text-warning-foreground sm:h-4 sm:w-4 sm:text-[9px]">
            {dayOffset > 0 ? `+${dayOffset}` : dayOffset}
          </div>
        )}
      </div>
      <span
        className="hidden truncate text-sm font-medium text-foreground sm:block"
        title={member.name}
      >
        {member.name}
      </span>
    </div>
  );

  if (dayOffsetLabel) {
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
