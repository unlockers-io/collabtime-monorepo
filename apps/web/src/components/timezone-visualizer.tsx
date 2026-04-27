"use client";

import { ScrollArea } from "@repo/ui/components/scroll-area";
import { TooltipProvider } from "@repo/ui/components/tooltip";
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";

import { useDragToScroll } from "@/hooks/use-drag-to-scroll";
import { getUserTimezone } from "@/lib/timezones";
import { useHalfMinuteTick } from "@/lib/use-tick";
import type { TeamGroup, TeamMember } from "@/types";

import { ComparePanel } from "./timezone-visualizer/compare-panel";
import { CurrentTimeIndicator } from "./timezone-visualizer/current-time-indicator";
import {
  EMPTY_COLLAPSED_IDS,
  EMPTY_GROUPS,
  HOVER_HIDE_DELAY_MS,
  getCurrentTimePosition,
  useClientValue,
} from "./timezone-visualizer/helpers";
import { Legend } from "./timezone-visualizer/legend";
import { MemberAvatar } from "./timezone-visualizer/member-avatar";
import {
  FindMeetingTimeButton,
  GroupHeader,
  MemberTimelineRow,
} from "./timezone-visualizer/subcomponents";
import { TimeAxis } from "./timezone-visualizer/time-axis";
import type { Selection } from "./timezone-visualizer/types";
import { useTimezoneData } from "./timezone-visualizer/use-timezone-data";

type TimezoneVisualizerProps = {
  collapsedGroupIds?: Array<string>;
  groups?: Array<TeamGroup>;
  members: Array<TeamMember>;
  onToggleGroupCollapse?: (groupId: string) => void;
};

const TimezoneVisualizer = ({
  collapsedGroupIds = EMPTY_COLLAPSED_IDS,
  groups = EMPTY_GROUPS,
  members,
  onToggleGroupCollapse,
}: TimezoneVisualizerProps) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const sectionsContainerRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLElement | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const { isDragging } = useDragToScroll(scrollViewportRef);

  useEffect(() => {
    const root = sectionsContainerRef.current;
    if (!root) {
      return;
    }
    const viewport = root.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
    scrollViewportRef.current = viewport;
  }, []);
  const lineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveringRef = useRef(false);
  const selectedBlockRef = useRef<number | null>(null);

  const lineX = useMotionValue(0);
  const lineOpacity = useMotionValue(0);

  const [isComparing, setIsComparing] = useState(false);
  const [compareSelections, setCompareSelections] = useState<Array<Selection>>([]);

  const collapsedSet = useMemo(() => new Set(collapsedGroupIds), [collapsedGroupIds]);

  const viewerTimezone = useClientValue(() => getUserTimezone(), "");

  // Tick timestamp that updates every 30 seconds - triggers recalculation for timeline
  const tick = useHalfMinuteTick();

  const nowPosition = useMemo(() => {
    if (!tick || !viewerTimezone) {
      return null;
    }
    return getCurrentTimePosition(viewerTimezone);
  }, [viewerTimezone, tick]);

  const {
    addSelection,
    canShowOverlap,
    groupedSections,
    groupNameById,
    isMemberInCompare,
    memberRowById,
    overlapData,
    overlapStatus,
    removeSelection,
    selectedMemberIds,
    totalPeopleSelected,
    validSelections,
  } = useTimezoneData({ compareSelections, groups, members, viewerTimezone });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !sectionsContainerRef.current) {
      return;
    }

    const containerRect = sectionsContainerRef.current.getBoundingClientRect();
    const relativeX = e.clientX - containerRect.left;

    lineX.set(relativeX);

    if (!isHoveringRef.current) {
      isHoveringRef.current = true;
      animate(lineOpacity, 1, { duration: 0.1 });
    }

    if (lineDebounceRef.current) {
      clearTimeout(lineDebounceRef.current);
    }

    lineDebounceRef.current = setTimeout(() => {
      animate(lineOpacity, 0, { duration: 0.2 });
    }, HOVER_HIDE_DELAY_MS);
  };

  const handleMouseLeave = () => {
    isHoveringRef.current = false;

    if (lineDebounceRef.current) {
      clearTimeout(lineDebounceRef.current);
      lineDebounceRef.current = null;
    }

    animate(lineOpacity, 0, { duration: 0.15 });
  };

  const closeComparePanel = () => {
    setIsComparing(false);
    setCompareSelections([]);
  };

  const openComparePanel = () => {
    setIsComparing(true);
  };

  useEffect(() => {
    return () => {
      if (lineDebounceRef.current) {
        clearTimeout(lineDebounceRef.current);
      }
    };
  }, []);

  if (members.length === 0 || !viewerTimezone) {
    return null;
  }

  const hasCrossTeamOverlap = overlapData.crossTeamOverlapHours.some(Boolean);

  return (
    <TooltipProvider delay={120}>
      <div className="flex flex-col gap-6">
        <TimeAxis />

        <ScrollArea
          className="relative flex max-h-80 flex-col gap-4 select-none"
          ref={sectionsContainerRef}
        >
          <CurrentTimeIndicator nowPosition={nowPosition} />

          {groupedSections.map((section, sectionIndex) => {
            const sectionGroup = section.group;
            const isCollapsed = sectionGroup ? collapsedSet.has(sectionGroup.id) : false;
            const visibleRows = isCollapsed ? [] : section.rows;

            return (
              <div className="flex flex-col gap-3" key={sectionGroup?.id ?? "ungrouped"}>
                {sectionGroup && (
                  <GroupHeader
                    group={sectionGroup}
                    isCollapsed={isCollapsed}
                    onToggle={() => onToggleGroupCollapse?.(sectionGroup.id)}
                    rowCount={section.rows.length}
                  />
                )}

                {!section.group && groups.length > 0 && (
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span>Ungrouped</span>
                    <span>({section.rows.length})</span>
                  </div>
                )}

                {visibleRows.length > 0 && (
                  <div key={`section-${section.group?.id ?? "ungrouped"}`}>
                    <div className="flex items-stretch gap-2 sm:gap-3">
                      <div className="flex w-8 shrink-0 flex-col gap-3 sm:w-24">
                        {visibleRows.map(({ dayOffset, member }) => (
                          <MemberAvatar
                            dayOffset={dayOffset}
                            isSelected={isMemberInCompare(member.id, isComparing)}
                            key={member.id}
                            member={member}
                            totalMembers={members.length}
                          />
                        ))}
                      </div>

                      <div
                        className="relative flex-1"
                        onMouseLeave={isDragging ? undefined : handleMouseLeave}
                        onMouseMove={isDragging ? undefined : handleMouseMove}
                        ref={sectionIndex === 0 ? timelineRef : undefined}
                      >
                        <div className="flex flex-col gap-3">
                          {visibleRows.map(({ hours, member }) => (
                            <MemberTimelineRow
                              hours={hours}
                              isDark={isDark}
                              key={member.id}
                              memberId={member.id}
                              memberTimezone={member.timezone}
                              selectedBlockRef={selectedBlockRef}
                              viewerTimezone={viewerTimezone}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </ScrollArea>

        {members.length >= 2 && (
          <AnimatePresence mode="wait">
            {!isComparing ? (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                initial={{ opacity: 0, y: 10 }}
                key="compare-button"
                transition={{ duration: 0.15 }}
              >
                <FindMeetingTimeButton onClick={openComparePanel} />
              </motion.div>
            ) : (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                initial={{ opacity: 0, y: 10 }}
                key="compare-panel"
                transition={{ duration: 0.15 }}
              >
                <ComparePanel
                  canShowOverlap={canShowOverlap}
                  groupNameById={groupNameById}
                  groups={groups}
                  memberRowById={memberRowById}
                  members={members}
                  onAddSelection={(sel) => addSelection(sel, setCompareSelections)}
                  onClose={closeComparePanel}
                  onRemoveSelection={(sel) => removeSelection(sel, setCompareSelections)}
                  overlapData={overlapData}
                  overlapStatus={overlapStatus}
                  selectedMemberIds={selectedMemberIds}
                  totalPeopleSelected={totalPeopleSelected}
                  validSelections={validSelections}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}

        <Legend
          canShowOverlap={canShowOverlap}
          hasCrossTeamOverlap={hasCrossTeamOverlap}
          isComparing={isComparing}
          totalPeopleSelected={totalPeopleSelected}
        />
      </div>
    </TooltipProvider>
  );
};

export { TimezoneVisualizer };
