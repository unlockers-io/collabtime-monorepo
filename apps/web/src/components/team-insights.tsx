"use client";

import { Users } from "lucide-react";
import type { ReactNode } from "react";

import {
  SectionCard,
  SectionCardContent,
  SectionCardHeader,
  SectionCardTitle,
} from "@/components/section-card";
import { useClientValue } from "@/components/timezone-visualizer/helpers";
import {
  formatDuration,
  formatMinuteOfDay,
  getMinutesUntilAvailable,
  getMinutesUntilDayEnds,
  getViewerTimezone,
  getWorkingInterval,
  isCurrentlyWorking,
} from "@/lib/timezones";
import { useHalfMinuteTick } from "@/lib/use-tick";
import type { TeamGroup, TeamMember } from "@/types";

const SOON_THRESHOLD_MINUTES = 2 * 60;
const EMPTY_GROUPS: Array<TeamGroup> = [];

type TeamInsightsProps = {
  groups?: Array<TeamGroup>;
  members: Array<TeamMember>;
};

type StatusEntry = {
  detail: string;
  member: TeamMember;
  minutes: number;
};

type StatusColumnProps = {
  emptyLabel: string;
  entries: ReadonlyArray<StatusEntry>;
  groupNameById: ReadonlyMap<string, string>;
  label: string;
};

const StatusColumn = ({ emptyLabel, entries, groupNameById, label }: StatusColumnProps) => (
  <div className="flex min-w-0 flex-col gap-2">
    <h3 className="flex items-baseline gap-2 text-xs font-medium text-muted-foreground">
      {label}
      <span className="font-mono text-foreground tabular-nums">{entries.length}</span>
    </h3>
    {entries.length === 0 ? (
      <p className="border-t border-border pt-2 text-xs text-muted-foreground">{emptyLabel}</p>
    ) : (
      <ul className="border-t border-border">
        {entries.map(({ detail, member }) => {
          const groupName = groupNameById.get(member.groupId ?? "");
          return (
            <li
              className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1.5 text-sm"
              key={member.id}
            >
              <span className="min-w-0 truncate">
                <span className="text-foreground">{member.name}</span>
                {groupName !== undefined && (
                  <span className="text-muted-foreground"> · {groupName}</span>
                )}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                {detail}
              </span>
            </li>
          );
        })}
      </ul>
    )}
  </div>
);

const byMinutes = (a: StatusEntry, b: StatusEntry) => a.minutes - b.minutes;

const TeamInsights = ({ groups = EMPTY_GROUPS, members }: TeamInsightsProps): ReactNode => {
  const viewerTimezone = useClientValue(getViewerTimezone, "");
  const tick = useHalfMinuteTick();

  if (members.length === 0 || !viewerTimezone || tick === 0) {
    return null;
  }

  const now = new Date(tick);
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));
  const working: Array<StatusEntry> = [];
  const startingSoon: Array<StatusEntry> = [];
  const wrappingUp: Array<StatusEntry> = [];

  for (const member of members) {
    const { timezone, workingHoursEnd, workingHoursStart } = member;
    const interval = getWorkingInterval(member, viewerTimezone, now);

    if (isCurrentlyWorking(timezone, workingHoursStart, workingHoursEnd, now)) {
      const minutesLeft = getMinutesUntilDayEnds(timezone, workingHoursEnd, now);
      const endsAt = formatMinuteOfDay(interval.startMinute + interval.lengthMinutes);
      working.push({ detail: `until ${endsAt}`, member, minutes: minutesLeft });
      if (minutesLeft <= SOON_THRESHOLD_MINUTES) {
        wrappingUp.push({
          detail: `${formatDuration(minutesLeft)} left`,
          member,
          minutes: minutesLeft,
        });
      }
      continue;
    }

    const minutesUntil = getMinutesUntilAvailable(
      timezone,
      workingHoursStart,
      workingHoursEnd,
      now,
    );
    if (minutesUntil <= SOON_THRESHOLD_MINUTES) {
      startingSoon.push({
        detail: `in ${formatDuration(minutesUntil)}`,
        member,
        minutes: minutesUntil,
      });
    }
  }

  return (
    <SectionCard>
      <SectionCardHeader>
        <SectionCardTitle icon={Users}>Team status</SectionCardTitle>
      </SectionCardHeader>
      <SectionCardContent>
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          <StatusColumn
            emptyLabel="No one is working right now."
            entries={working.toSorted(byMinutes).toReversed()}
            groupNameById={groupNameById}
            label="Working now"
          />
          <StatusColumn
            emptyLabel="No one starts in the next 2 hours."
            entries={startingSoon.toSorted(byMinutes)}
            groupNameById={groupNameById}
            label="Starting soon"
          />
          <StatusColumn
            emptyLabel="No one finishes in the next 2 hours."
            entries={wrappingUp.toSorted(byMinutes)}
            groupNameById={groupNameById}
            label="Wrapping up"
          />
        </div>
      </SectionCardContent>
    </SectionCard>
  );
};

export { TeamInsights };
