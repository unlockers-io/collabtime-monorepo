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
import { Fragment, useSyncExternalStore } from "react";

import {
  SectionCard,
  SectionCardContent,
  SectionCardHeader,
  SectionCardTitle,
} from "@/components/section-card";
import { getUserTimezone, isCurrentlyWorking, convertHourToTimezone } from "@/lib/timezones";
import { useHalfMinuteTick } from "@/lib/use-tick";
import type { TeamGroup, TeamMember } from "@/types";

const SOON_THRESHOLD_HOURS = 2;
const EMPTY_GROUPS: Array<TeamGroup> = [];

type TeamInsightsProps = {
  groups?: Array<TeamGroup>;
  members: Array<TeamMember>;
};

// No-op subscribe function for useSyncExternalStore when no subscriptions are needed
const emptySubscribe = () => () => {};

const useClientValue = <T,>(clientValue: () => T, serverValue: T): T => {
  return useSyncExternalStore(emptySubscribe, clientValue, () => serverValue);
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

const TeamInsights = ({ groups = EMPTY_GROUPS, members }: TeamInsightsProps) => {
  const viewerTimezone = useClientValue(() => getUserTimezone(), "");
  // Re-render every 30s for live status. React Compiler memoizes the
  // computations below.
  useHalfMinuteTick();

  const memberStatuses = ((): Array<MemberStatus> => {
    if (!viewerTimezone) {
      return [];
    }

    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: viewerTimezone,
    });
    const hourPart = formatter.formatToParts(now).find((p) => p.type === "hour");
    const currentHourInViewer = hourPart ? Number.parseInt(hourPart.value, 10) : 0;

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

      let hoursUntilStart: number | null = null;
      let hoursUntilEnd: number | null = null;

      if (!working) {
        let diff = startInViewer - currentHourInViewer;
        if (diff < 0) {
          diff += 24;
        }
        hoursUntilStart = diff;
      } else {
        let diff = endInViewer - currentHourInViewer;
        if (diff < 0) {
          diff += 24;
        }
        hoursUntilEnd = diff;
      }

      return {
        hoursUntilEnd,
        hoursUntilStart,
        isWorking: working,
        member,
      };
    });
  })();

  const onlineMembers = memberStatuses.filter((s) => s.isWorking);

  const comingSoonMembers = memberStatuses
    .filter(
      (s) =>
        !s.isWorking && s.hoursUntilStart !== null && s.hoursUntilStart <= SOON_THRESHOLD_HOURS,
    )
    .toSorted((a, b) => (a.hoursUntilStart ?? 0) - (b.hoursUntilStart ?? 0));

  const leavingSoonMembers = memberStatuses
    .filter(
      (s) => s.isWorking && s.hoursUntilEnd !== null && s.hoursUntilEnd <= SOON_THRESHOLD_HOURS,
    )
    .toSorted((a, b) => (a.hoursUntilEnd ?? 0) - (b.hoursUntilEnd ?? 0));

  const getGroupName = (groupId?: string) => {
    if (!groupId) {
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
            {onlineMembers.map(({ member }) => {
              const groupName = getGroupName(member.groupId);
              const badge = (
                <Badge className={cn(groupName && "cursor-help")} variant="success">
                  <span className="size-1.5 rounded-full bg-success" />
                  {member.name}
                </Badge>
              );
              return groupName ? (
                <Tooltip key={member.id}>
                  <TooltipTrigger render={<span />}>{badge}</TooltipTrigger>
                  <TooltipContent>
                    <p>{groupName}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Fragment key={member.id}>{badge}</Fragment>
              );
            })}
          </StatusGroup>

          <StatusGroup
            count={comingSoonMembers.length}
            emptyLabel={`No one starting in the next ${SOON_THRESHOLD_HOURS} hours`}
            icon={Sunrise}
            label="Starting Soon"
            tone="warning"
          >
            {comingSoonMembers.map(({ hoursUntilStart, member }) => {
              const groupName = getGroupName(member.groupId);
              const badge = (
                <Badge className={cn(groupName && "cursor-help")} variant="warning">
                  {member.name}
                  <span className="text-xs tabular-nums opacity-80">in {hoursUntilStart}h</span>
                </Badge>
              );
              return groupName ? (
                <Tooltip key={member.id}>
                  <TooltipTrigger render={<span />}>{badge}</TooltipTrigger>
                  <TooltipContent>
                    <p>{groupName}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Fragment key={member.id}>{badge}</Fragment>
              );
            })}
          </StatusGroup>

          <StatusGroup
            className="sm:col-span-2 lg:col-span-1"
            count={leavingSoonMembers.length}
            emptyLabel={`No one ending in the next ${SOON_THRESHOLD_HOURS} hours`}
            icon={Clock}
            label="Wrapping Up"
            tone="info"
          >
            {leavingSoonMembers.map(({ hoursUntilEnd, member }) => {
              const groupName = getGroupName(member.groupId);
              const badge = (
                <Badge className={cn(groupName && "cursor-help")} variant="info">
                  {member.name}
                  <span className="text-xs tabular-nums opacity-80">{hoursUntilEnd}h left</span>
                </Badge>
              );
              return groupName ? (
                <Tooltip key={member.id}>
                  <TooltipTrigger render={<span />}>{badge}</TooltipTrigger>
                  <TooltipContent>
                    <p>{groupName}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Fragment key={member.id}>{badge}</Fragment>
              );
            })}
          </StatusGroup>
        </div>
      </SectionCardContent>
    </SectionCard>
  );
};

export { TeamInsights };
