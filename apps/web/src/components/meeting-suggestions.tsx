"use client";

import { useMemo, useState } from "react";
import { Calendar, Clock, Crown, Users, ChevronDown } from "lucide-react";
import type { TeamMember, TeamGroup } from "@/types";
import { Button, Card } from "@repo/ui";

type MeetingSuggestionsProps = {
  members: TeamMember[];
  groups: TeamGroup[];
  isPro: boolean;
};

type TimeSlot = {
  hour: number;
  availableCount: number;
  availableMembers: TeamMember[];
  percentage: number;
};

const MeetingSuggestions = ({
  members,
  groups,
  isPro,
}: MeetingSuggestionsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  // Filter members by selected group
  const filteredMembers = useMemo(() => {
    if (!selectedGroup) return members;
    return members.filter((m) => m.groupId === selectedGroup);
  }, [members, selectedGroup]);

  // Calculate overlap hours for filtered members
  const timeSlots = useMemo<TimeSlot[]>(() => {
    if (filteredMembers.length === 0) return [];

    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const slots: TimeSlot[] = [];

    for (let userHour = 0; userHour < 24; userHour++) {
      const availableMembers: TeamMember[] = [];

      for (const member of filteredMembers) {
        // Convert user's local hour to member's local hour
        const userDate = new Date();
        userDate.setHours(userHour, 0, 0, 0);

        // Get member's local hour at this time
        const memberHour = parseInt(
          userDate.toLocaleString("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: member.timezone,
          })
        );

        // Check if member is working at this hour
        const start = member.workingHoursStart;
        const end = member.workingHoursEnd;

        let isWorking: boolean;
        if (start <= end) {
          // Normal case: e.g., 9-17
          isWorking = memberHour >= start && memberHour < end;
        } else {
          // Overnight case: e.g., 22-6
          isWorking = memberHour >= start || memberHour < end;
        }

        if (isWorking) {
          availableMembers.push(member);
        }
      }

      slots.push({
        hour: userHour,
        availableCount: availableMembers.length,
        availableMembers,
        percentage:
          filteredMembers.length > 0
            ? (availableMembers.length / filteredMembers.length) * 100
            : 0,
      });
    }

    return slots;
  }, [filteredMembers]);

  // Find the best meeting times (100% availability or highest available)
  const bestSlots = useMemo(() => {
    if (timeSlots.length === 0) return [];

    // Sort by availability count, then by business hours preference (9-17)
    return [...timeSlots]
      .filter((slot) => slot.availableCount > 0)
      .sort((a, b) => {
        // First, sort by number of available members
        if (b.availableCount !== a.availableCount) {
          return b.availableCount - a.availableCount;
        }
        // Then prefer business hours (9-17)
        const aInBusinessHours = a.hour >= 9 && a.hour <= 17;
        const bInBusinessHours = b.hour >= 9 && b.hour <= 17;
        if (aInBusinessHours && !bInBusinessHours) return -1;
        if (!aInBusinessHours && bInBusinessHours) return 1;
        return 0;
      })
      .slice(0, 5);
  }, [timeSlots]);

  const formatHour = (hour: number): string => {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (members.length < 2) {
    return null;
  }

  if (!isPro) {
    return (
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            Meeting Suggestions
          </h2>
          <span className="flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <Crown className="h-3 w-3" />
            PRO
          </span>
        </div>
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border bg-muted/50 px-6 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Calendar className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold text-foreground">
              Find the best meeting times
            </h3>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              Upgrade to PRO to get AI-powered suggestions for the best times to
              meet based on everyone&apos;s working hours.
            </p>
          </div>
          <a
            href="/settings"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-amber-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
          >
            <Crown className="h-4 w-4" />
            Upgrade to PRO
          </a>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          Meeting Suggestions
        </h2>
        {groups.length > 0 && (
          <select
            value={selectedGroup ?? ""}
            onChange={(e) => setSelectedGroup(e.target.value || null)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="">All members</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {bestSlots.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No overlapping working hours found for the selected members.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Best times to meet (in your local time):
          </p>

          <div className="flex flex-col gap-2">
            {bestSlots.slice(0, isExpanded ? 5 : 3).map((slot) => (
              <div
                key={slot.hour}
                className="flex items-center gap-3 rounded-lg border border-border bg-secondary/50 px-3 py-2"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {formatHour(slot.hour)} - {formatHour(slot.hour + 1)}
                    </span>
                    {slot.percentage === 100 && (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        100% available
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {slot.availableCount} of {filteredMembers.length} members
                    available ({Math.round(slot.percentage)}%)
                  </div>
                </div>
                <div className="h-2 w-20 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${slot.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {bestSlots.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="self-center"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
              {isExpanded ? "Show less" : `Show ${bestSlots.length - 3} more`}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
};

export { MeetingSuggestions };
