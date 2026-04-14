"use client";

import { Badge } from "@repo/ui/components/badge";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Circle, Clock, Sunrise, Users } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";

import { getUserTimezone, isCurrentlyWorking, convertHourToTimezone } from "@/lib/timezones";
import type { TeamGroup, TeamMember } from "@/types";

const SOON_THRESHOLD_HOURS = 2;
const SCROLL_AREA_MAX_HEIGHT = 120;
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

const tickSubscribe = (callback: () => void) => {
  const interval = setInterval(callback, 30_000);
  return () => clearInterval(interval);
};
const getTickSnapshot = () => Date.now();
const getTickServerSnapshot = () => 0;

type MemberStatus = {
  hoursUntilEnd: number | null;
  hoursUntilStart: number | null;
  isWorking: boolean;
  member: TeamMember;
};

const TeamInsights = ({ members, groups = EMPTY_GROUPS }: TeamInsightsProps) => {
  const viewerTimezone = useClientValue(() => getUserTimezone(), "");
  const tick = useSyncExternalStore(tickSubscribe, getTickSnapshot, getTickServerSnapshot);

  const memberStatuses = useMemo((): Array<MemberStatus> => {
    if (!viewerTimezone) {
      return [];
    }
    // Include tick in the dependency to trigger recalculation every 30 seconds
    void tick;

    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: viewerTimezone,
      hour: "numeric",
      hour12: false,
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
        member,
        isWorking: working,
        hoursUntilStart,
        hoursUntilEnd,
      };
    });
  }, [members, viewerTimezone, tick]);

  const onlineMembers = useMemo(() => memberStatuses.filter((s) => s.isWorking), [memberStatuses]);

  const comingSoonMembers = useMemo(
    () =>
      memberStatuses
        .filter(
          (s) =>
            !s.isWorking && s.hoursUntilStart !== null && s.hoursUntilStart <= SOON_THRESHOLD_HOURS,
        )
        .sort((a, b) => (a.hoursUntilStart ?? 0) - (b.hoursUntilStart ?? 0)),
    [memberStatuses],
  );

  const leavingSoonMembers = useMemo(
    () =>
      memberStatuses
        .filter(
          (s) => s.isWorking && s.hoursUntilEnd !== null && s.hoursUntilEnd <= SOON_THRESHOLD_HOURS,
        )
        .sort((a, b) => (a.hoursUntilEnd ?? 0) - (b.hoursUntilEnd ?? 0)),
    [memberStatuses],
  );

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
    <div className="gap-4 rounded-2xl p-4 shadow-sm sm:p-5 flex flex-col border border-border bg-card">
      <div className="gap-2 text-sm font-semibold flex items-center text-foreground">
        <Users className="h-4 w-4 text-muted-foreground" />
        Team Status
      </div>

      <div className="gap-4 sm:grid-cols-2 lg:grid-cols-3 grid">
        {/* Online Now */}
        <div className="gap-2.5 p-3.5 flex flex-col rounded-xl bg-secondary">
          <div className="gap-2 flex items-center">
            <div className="h-6 w-6 bg-green-100 dark:bg-green-900/30 flex items-center justify-center rounded-full">
              <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Online Now</span>
            <span className="bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400 ml-auto rounded-full tabular-nums">
              {onlineMembers.length}
            </span>
          </div>
          {onlineMembers.length > 0 ? (
            <ScrollArea style={{ maxHeight: SCROLL_AREA_MAX_HEIGHT }}>
              <div className="gap-1.5 px-1 py-0.5 flex flex-wrap">
                {onlineMembers.map(({ member }) => {
                  const groupName = getGroupName(member.groupId);
                  return (
                    <Badge
                      key={member.id}
                      className="shadow-sm cursor-help bg-background text-foreground"
                      title={groupName ? `${member.name} (${groupName})` : member.name}
                    >
                      <span className="h-1.5 w-1.5 bg-green-500 rounded-full" />
                      {member.name}
                    </Badge>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-muted-foreground">No one is currently working</p>
          )}
        </div>

        {/* Coming Soon */}
        <div className="gap-2.5 p-3.5 flex flex-col rounded-xl bg-secondary">
          <div className="gap-2 flex items-center">
            <div className="h-6 w-6 bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center rounded-full">
              <Sunrise className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Starting Soon</span>
            <span className="bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 ml-auto rounded-full tabular-nums">
              {comingSoonMembers.length}
            </span>
          </div>
          {comingSoonMembers.length > 0 ? (
            <ScrollArea style={{ maxHeight: SCROLL_AREA_MAX_HEIGHT }}>
              <div className="gap-1.5 px-1 py-0.5 flex flex-wrap">
                {comingSoonMembers.map(({ member, hoursUntilStart }) => {
                  const groupName = getGroupName(member.groupId);

                  return (
                    <Badge
                      key={member.id}
                      className="shadow-sm cursor-help bg-background"
                      title={groupName ? `${member.name} (${groupName})` : member.name}
                    >
                      <span className="text-xs font-medium text-foreground">{member.name}</span>
                      <span className="text-xs text-amber-600 dark:text-amber-400 tabular-nums">
                        in {hoursUntilStart}h
                      </span>
                    </Badge>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-muted-foreground">
              No one starting in the next {SOON_THRESHOLD_HOURS} hours
            </p>
          )}
        </div>

        {/* Leaving Soon */}
        <div className="gap-2.5 p-3.5 sm:col-span-2 lg:col-span-1 flex flex-col rounded-xl bg-secondary">
          <div className="gap-2 flex items-center">
            <div className="h-6 w-6 bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center rounded-full">
              <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Wrapping Up</span>
            <span className="bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 ml-auto rounded-full tabular-nums">
              {leavingSoonMembers.length}
            </span>
          </div>
          {leavingSoonMembers.length > 0 ? (
            <ScrollArea style={{ maxHeight: SCROLL_AREA_MAX_HEIGHT }}>
              <div className="gap-1.5 px-1 py-0.5 flex flex-wrap">
                {leavingSoonMembers.map(({ member, hoursUntilEnd }) => {
                  const groupName = getGroupName(member.groupId);

                  return (
                    <Badge
                      key={member.id}
                      className="shadow-sm cursor-help bg-background"
                      title={groupName ? `${member.name} (${groupName})` : member.name}
                    >
                      <span className="text-xs font-medium text-foreground">{member.name}</span>
                      <span className="text-xs text-blue-600 dark:text-blue-400 tabular-nums">
                        {hoursUntilEnd}h left
                      </span>
                    </Badge>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-muted-foreground">
              No one ending in the next {SOON_THRESHOLD_HOURS} hours
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export { TeamInsights };
