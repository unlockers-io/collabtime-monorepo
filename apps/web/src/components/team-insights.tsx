"use client";

import { Badge } from "@repo/ui/components/badge";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { Circle, Clock, Sunrise, Users } from "lucide-react";

import {
  SectionCard,
  SectionCardContent,
  SectionCardHeader,
  SectionCardTitle,
} from "@/components/section-card";
import { HOURS_IN_DAY, useClientValue } from "@/components/timezone-visualizer/helpers";
import { getUserTimezone, isCurrentlyWorking, convertHourToTimezone } from "@/lib/timezones";
import { useHalfMinuteTick } from "@/lib/use-tick";
import type { TeamGroup, TeamMember } from "@/types";

const SOON_THRESHOLD_HOURS = 2;
const EMPTY_GROUPS: Array<TeamGroup> = [];

type TeamInsightsProps = {
  groups?: Array<TeamGroup>;
  members: Array<TeamMember>;
};

type MemberStatus = {
  hoursUntilEnd: number | null;
  hoursUntilStart: number | null;
  isWorking: boolean;
  member: TeamMember;
};

type StatusTone = "info" | "success" | "warning";

type StatusGroupProps = {
  children: React.ReactNode;
  className?: string;
  count: number;
  emptyLabel: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  iconClassName?: string;
  label: string;
  tone: StatusTone;
};

const TONE_TEXT: Record<StatusTone, string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
};

const StatusGroup = ({
  children,
  className,
  count,
  emptyLabel,
  icon: Icon,
  iconClassName,
  label,
  tone,
}: StatusGroupProps) => {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-lg border border-border/60 bg-secondary/40 p-3.5",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("size-4 shrink-0", iconClassName ?? TONE_TEXT[tone])} />
        <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
        <Badge className="ml-auto tabular-nums" variant={tone}>
          {count}
        </Badge>
      </div>
      {count > 0 ? (
        <ScrollArea className="max-h-30">
          <TooltipProvider>
            <div className="flex flex-wrap gap-1.5 px-1 py-0.5">{children}</div>
          </TooltipProvider>
        </ScrollArea>
      ) : (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
};

type StatusBadgeProps = {
  children: React.ReactNode;
  groupName: string | null;
  tone: StatusTone;
};

const StatusBadge = ({ children, groupName, tone }: StatusBadgeProps) => {
  const hasGroup = groupName !== null && groupName !== "";
  const badge = (
    <Badge className={cn(hasGroup && "cursor-help")} variant={tone}>
      {children}
    </Badge>
  );

  if (!hasGroup) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>{badge}</TooltipTrigger>
      <TooltipContent>
        <p>{groupName}</p>
      </TooltipContent>
    </Tooltip>
  );
};

const TeamInsights = ({ groups = EMPTY_GROUPS, members }: TeamInsightsProps) => {
  const viewerTimezone = useClientValue(() => getUserTimezone(), "");
  useHalfMinuteTick();

  const hourFormatter = viewerTimezone
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: viewerTimezone,
      })
    : null;

  const memberStatuses = (): Array<MemberStatus> => {
    if (!viewerTimezone || !hourFormatter) {
      return [];
    }

    const now = new Date();
    const hourPart = hourFormatter.formatToParts(now).find((p) => p.type === "hour");
    const currentHourInViewer = hourPart ? Math.trunc(Number(hourPart.value)) : 0;

    return members.map((member) => {
      const working = isCurrentlyWorking(
        member.timezone,
        member.workingHoursStart,
        member.workingHoursEnd,
      );

      const startInViewer = convertHourToTimezone(
        member.workingHoursStart,
        member.timezone,
        viewerTimezone,
      );
      const endInViewer = convertHourToTimezone(
        member.workingHoursEnd,
        member.timezone,
        viewerTimezone,
      );

      const hoursUntil = (hourInViewer: number) =>
        (hourInViewer - currentHourInViewer + HOURS_IN_DAY) % HOURS_IN_DAY;

      return {
        hoursUntilEnd: working ? hoursUntil(endInViewer) : null,
        hoursUntilStart: working ? null : hoursUntil(startInViewer),
        isWorking: working,
        member,
      };
    });
  };

  const computedMemberStatuses = memberStatuses();

  const onlineMembers = computedMemberStatuses.filter((s) => s.isWorking);

  const comingSoonMembers = computedMemberStatuses
    .filter(
      (s) =>
        !s.isWorking && s.hoursUntilStart !== null && s.hoursUntilStart <= SOON_THRESHOLD_HOURS,
    )
    .toSorted((a, b) => (a.hoursUntilStart ?? 0) - (b.hoursUntilStart ?? 0));

  const leavingSoonMembers = computedMemberStatuses
    .filter(
      (s) => s.isWorking && s.hoursUntilEnd !== null && s.hoursUntilEnd <= SOON_THRESHOLD_HOURS,
    )
    .toSorted((a, b) => (a.hoursUntilEnd ?? 0) - (b.hoursUntilEnd ?? 0));

  const getGroupName = (groupId?: string) => {
    if (groupId === undefined || groupId === "") {
      return null;
    }
    return groups.find((g) => g.id === groupId)?.name ?? null;
  };

  if (members.length === 0 || !viewerTimezone) {
    return null;
  }

  return (
    <SectionCard>
      <SectionCardHeader>
        <SectionCardTitle icon={Users}>Team Status</SectionCardTitle>
      </SectionCardHeader>
      <SectionCardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatusGroup
            count={onlineMembers.length}
            emptyLabel="No one is currently working"
            icon={Circle}
            iconClassName="size-3 fill-success text-success"
            label="Online Now"
            tone="success"
          >
            {onlineMembers.map(({ member }) => (
              <StatusBadge groupName={getGroupName(member.groupId)} key={member.id} tone="success">
                <span className="size-1.5 rounded-full bg-success" />
                {member.name}
              </StatusBadge>
            ))}
          </StatusGroup>

          <StatusGroup
            count={comingSoonMembers.length}
            emptyLabel={`No one starting in the next ${SOON_THRESHOLD_HOURS} hours`}
            icon={Sunrise}
            label="Starting Soon"
            tone="warning"
          >
            {comingSoonMembers.map(({ hoursUntilStart, member }) => (
              <StatusBadge groupName={getGroupName(member.groupId)} key={member.id} tone="warning">
                {member.name}
                <span className="text-xs tabular-nums opacity-80">in {hoursUntilStart}h</span>
              </StatusBadge>
            ))}
          </StatusGroup>

          <StatusGroup
            className="sm:col-span-2 lg:col-span-1"
            count={leavingSoonMembers.length}
            emptyLabel={`No one ending in the next ${SOON_THRESHOLD_HOURS} hours`}
            icon={Clock}
            label="Wrapping Up"
            tone="info"
          >
            {leavingSoonMembers.map(({ hoursUntilEnd, member }) => (
              <StatusBadge groupName={getGroupName(member.groupId)} key={member.id} tone="info">
                {member.name}
                <span className="text-xs tabular-nums opacity-80">{hoursUntilEnd}h left</span>
              </StatusBadge>
            ))}
          </StatusGroup>
        </div>
      </SectionCardContent>
    </SectionCard>
  );
};

export { TeamInsights };
