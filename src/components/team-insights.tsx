"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Circle, Clock, Sunrise, Users } from "lucide-react";
import type { TeamGroup, TeamMember } from "@/types";
import { getUserTimezone, isCurrentlyWorking, convertHourToTimezone } from "@/lib/timezones";
import { ScrollArea } from "@/components/ui/scroll-area";

const SOON_THRESHOLD_HOURS = 2;
const SCROLL_AREA_MAX_HEIGHT = 120;

type TeamInsightsProps = {
  members: TeamMember[];
  groups?: TeamGroup[];
};

// No-op subscribe function for useSyncExternalStore when no subscriptions are needed
const emptySubscribe = () => () => {};

const useClientValue = <T,>(clientValue: () => T, serverValue: T): T => {
  return useSyncExternalStore(emptySubscribe, clientValue, () => serverValue);
};

const tickSubscribe = (callback: () => void) => {
  const interval = setInterval(callback, 30000);
  return () => clearInterval(interval);
};
const getTickSnapshot = () => Date.now();
const getTickServerSnapshot = () => 0;

type MemberStatus = {
  member: TeamMember;
  isWorking: boolean;
  hoursUntilStart: number | null;
  hoursUntilEnd: number | null;
};

const TeamInsights = ({ members, groups = [] }: TeamInsightsProps) => {
  const viewerTimezone = useClientValue(() => getUserTimezone(), "");
  const tick = useSyncExternalStore(
    tickSubscribe,
    getTickSnapshot,
    getTickServerSnapshot
  );

  const memberStatuses = useMemo((): MemberStatus[] => {
    if (!viewerTimezone) return [];
    // Include tick in the dependency to trigger recalculation every 30 seconds
    void tick;

    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: viewerTimezone,
      hour: "numeric",
      hour12: false,
    });
    const hourPart = formatter.formatToParts(now).find((p) => p.type === "hour");
    const currentHourInViewer = hourPart ? parseInt(hourPart.value, 10) : 0;

    return members.map((member) => {
      const working = isCurrentlyWorking(
        member.timezone,
        member.workingHoursStart,
        member.workingHoursEnd
      );

      const startInViewer = convertHourToTimezone(
        member.workingHoursStart,
        member.timezone,
        viewerTimezone
      );
      const endInViewer = convertHourToTimezone(
        member.workingHoursEnd,
        member.timezone,
        viewerTimezone
      );

      let hoursUntilStart: number | null = null;
      let hoursUntilEnd: number | null = null;

      if (!working) {
        let diff = startInViewer - currentHourInViewer;
        if (diff < 0) diff += 24;
        hoursUntilStart = diff;
      } else {
        let diff = endInViewer - currentHourInViewer;
        if (diff < 0) diff += 24;
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

  const onlineMembers = useMemo(
    () => memberStatuses.filter((s) => s.isWorking),
    [memberStatuses]
  );

  const comingSoonMembers = useMemo(
    () =>
      memberStatuses
        .filter((s) => !s.isWorking && s.hoursUntilStart !== null && s.hoursUntilStart <= SOON_THRESHOLD_HOURS)
        .sort((a, b) => (a.hoursUntilStart ?? 0) - (b.hoursUntilStart ?? 0)),
    [memberStatuses]
  );

  const leavingSoonMembers = useMemo(
    () =>
      memberStatuses
        .filter((s) => s.isWorking && s.hoursUntilEnd !== null && s.hoursUntilEnd <= SOON_THRESHOLD_HOURS)
        .sort((a, b) => (a.hoursUntilEnd ?? 0) - (b.hoursUntilEnd ?? 0)),
    [memberStatuses]
  );

  const getGroupName = (groupId?: string) => {
    if (!groupId) return null;
    return groups.find((g) => g.id === groupId)?.name ?? null;
  };

  if (members.length === 0 || !viewerTimezone) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        <Users className="h-4 w-4 text-neutral-500" />
        Team Status
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Online Now */}
        <div className="flex flex-col gap-2.5 rounded-xl bg-neutral-50 p-3.5 dark:bg-neutral-800/50">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" />
            </div>
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Online Now
            </span>
            <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-green-700 dark:bg-green-900/40 dark:text-green-400">
              {onlineMembers.length}
            </span>
          </div>
          {onlineMembers.length > 0 ? (
            <ScrollArea style={{ maxHeight: SCROLL_AREA_MAX_HEIGHT }}>
              <div className="flex flex-wrap gap-1.5 pr-2">
                {onlineMembers.map(({ member }) => {
                  const groupName = getGroupName(member.groupId);
                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 shadow-sm dark:bg-neutral-700 dark:text-neutral-200"
                      title={groupName ? `${member.name} (${groupName})` : member.name}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      {member.name}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              No one is currently working
            </p>
          )}
        </div>

        {/* Coming Soon */}
        <div className="flex flex-col gap-2.5 rounded-xl bg-neutral-50 p-3.5 dark:bg-neutral-800/50">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Sunrise className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Starting Soon
            </span>
            <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              {comingSoonMembers.length}
            </span>
          </div>
          {comingSoonMembers.length > 0 ? (
            <ScrollArea style={{ maxHeight: SCROLL_AREA_MAX_HEIGHT }}>
              <div className="flex flex-col gap-1.5 pr-2">
                {comingSoonMembers.map(({ member, hoursUntilStart }) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 shadow-sm dark:bg-neutral-700"
                  >
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
                      {member.name}
                    </span>
                    <span className="text-xs tabular-nums text-amber-600 dark:text-amber-400">
                      in {hoursUntilStart}h
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              No one starting in the next {SOON_THRESHOLD_HOURS} hours
            </p>
          )}
        </div>

        {/* Leaving Soon */}
        <div className="flex flex-col gap-2.5 rounded-xl bg-neutral-50 p-3.5 dark:bg-neutral-800/50 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Wrapping Up
            </span>
            <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
              {leavingSoonMembers.length}
            </span>
          </div>
          {leavingSoonMembers.length > 0 ? (
            <ScrollArea style={{ maxHeight: SCROLL_AREA_MAX_HEIGHT }}>
              <div className="flex flex-col gap-1.5 pr-2">
                {leavingSoonMembers.map(({ member, hoursUntilEnd }) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 shadow-sm dark:bg-neutral-700"
                  >
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
                      {member.name}
                    </span>
                    <span className="text-xs tabular-nums text-blue-600 dark:text-blue-400">
                      {hoursUntilEnd}h left
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              No one ending in the next {SOON_THRESHOLD_HOURS} hours
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export { TeamInsights };
