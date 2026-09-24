"use client";

import { TooltipProvider } from "@repo/ui/components/tooltip";
import { useState } from "react";

import { getMinuteOfDay, getViewerTimezone } from "@/lib/timezones";
import { useHalfMinuteTick } from "@/lib/use-tick";
import type { TeamGroup, TeamMember } from "@/types";

import { CurrentTimeIndicator } from "./timezone-visualizer/current-time-indicator";
import { EMPTY_GROUPS, EMPTY_IDS, useClientValue } from "./timezone-visualizer/helpers";
import { Legend } from "./timezone-visualizer/legend";
import { GroupHeader, MemberTimelineRow } from "./timezone-visualizer/member-timeline-row";
import { SharedWindowSummary } from "./timezone-visualizer/shared-window-summary";
import { TimeAxis } from "./timezone-visualizer/time-axis";
import { getTimezoneData } from "./timezone-visualizer/timezone-data";

type TimezoneVisualizerProps = {
  collapsedGroupIds?: ReadonlyArray<string>;
  /** Controlled list of people left out of the best window; omit to keep it local. */
  excludedMemberIds?: ReadonlyArray<string>;
  groups?: Array<TeamGroup>;
  members: Array<TeamMember>;
  onExcludedMemberIdsChange?: (memberIds: Array<string>) => void;
  onToggleGroupCollapse?: (groupId: string) => void;
};

const TimezoneVisualizer = ({
  collapsedGroupIds = EMPTY_IDS,
  excludedMemberIds: controlledExcluded,
  groups = EMPTY_GROUPS,
  members,
  onExcludedMemberIdsChange,
  onToggleGroupCollapse,
}: TimezoneVisualizerProps) => {
  const [localExcluded, setLocalExcluded] = useState<ReadonlyArray<string>>(EMPTY_IDS);
  const excludedIds = controlledExcluded ?? localExcluded;

  const setExcluded = (next: Array<string>) => {
    if (onExcludedMemberIdsChange) {
      onExcludedMemberIdsChange(next);
      return;
    }
    setLocalExcluded(next);
  };

  const viewerTimezone = useClientValue(getViewerTimezone, "");
  const tick = useHalfMinuteTick();

  if (members.length === 0 || !viewerTimezone || tick === 0) {
    return null;
  }

  const now = new Date(tick);
  const nowMinute = getMinuteOfDay(viewerTimezone, now);
  const memberIds = new Set(members.map((member) => member.id));
  const excludedSet = new Set(excludedIds.filter((id) => memberIds.has(id)));
  const collapsedSet = new Set(collapsedGroupIds);

  const { groupedSections, reading, rows } = getTimezoneData({
    collapsedGroupIds: collapsedSet,
    excludedMemberIds: excludedSet,
    groups,
    members,
    now,
    nowMinute,
    viewerTimezone,
  });

  const primaryAvailable = new Set(reading.primary?.run.availableMemberIds);
  const hasCollapsedCounted = groupedSections.some(
    (section) => section.group !== null && collapsedSet.has(section.group.id),
  );

  const toggleCounted = (memberId: string) => {
    setExcluded(
      excludedSet.has(memberId)
        ? [...excludedSet].filter((id) => id !== memberId)
        : [...excludedSet, memberId],
    );
  };

  return (
    <TooltipProvider delay={120}>
      <div className="flex flex-col gap-6">
        <SharedWindowSummary
          hasCollapsedGroups={hasCollapsedCounted}
          hasExplicitExclusions={excludedSet.size > 0}
          onCountEveryone={() => {
            setExcluded([]);
          }}
          reading={reading}
          rows={rows}
          viewerTimezone={viewerTimezone}
        />

        <div className="flex flex-col gap-3">
          <TimeAxis />

          <div className="relative flex flex-col">
            <CurrentTimeIndicator nowMinute={nowMinute} />

            {groupedSections.map((section) => {
              const sectionGroup = section.group;
              const isCollapsed = sectionGroup ? collapsedSet.has(sectionGroup.id) : false;

              return (
                <div
                  className="flex flex-col gap-3 border-b border-border/50 py-4 first:pt-0 last:border-b-0 last:pb-0"
                  key={sectionGroup?.id ?? "ungrouped"}
                >
                  {sectionGroup && (
                    <GroupHeader
                      group={sectionGroup}
                      isCollapsed={isCollapsed}
                      onToggle={() => onToggleGroupCollapse?.(sectionGroup.id)}
                      rowCount={section.rows.length}
                    />
                  )}

                  {!sectionGroup && groups.length > 0 && (
                    <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <span>Ungrouped</span>
                      <span className="font-mono tabular-nums">{section.rows.length}</span>
                    </p>
                  )}

                  {!isCollapsed && (
                    <div
                      className="flex flex-col gap-3"
                      id={sectionGroup ? `tz-group-${sectionGroup.id}` : undefined}
                    >
                      {section.rows.map((row) => (
                        <MemberTimelineRow
                          bestSlots={reading.bestSlots}
                          isInBestWindow={primaryAvailable.has(row.member.id)}
                          key={row.member.id}
                          onToggleCounted={toggleCounted}
                          row={row}
                          viewerTimezone={viewerTimezone}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Legend
          hasExcluded={rows.some((row) => !row.isCounted)}
          showsSharedWindow={reading.windows.length > 0}
        />
      </div>
    </TooltipProvider>
  );
};

export { TimezoneVisualizer };
