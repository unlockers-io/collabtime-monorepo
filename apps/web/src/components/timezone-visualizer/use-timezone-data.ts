"use client";

import { useMemo } from "react";

import { convertHourToTimezone, getDayOffset } from "@/lib/timezones";
import type { TeamGroup, TeamMember } from "@/types";

import { EMPTY_HOURS, EMPTY_OVERLAP_DATA, HOURS_IN_DAY, serializeSelection } from "./helpers";
import type { GroupedSection, MemberRow, OverlapData, OverlapStatus, Selection } from "./types";

type UseTimezoneDataArgs = {
  compareSelections: Array<Selection>;
  groups: Array<TeamGroup>;
  members: Array<TeamMember>;
  viewerTimezone: string;
};

const useTimezoneData = ({
  compareSelections,
  groups,
  members,
  viewerTimezone,
}: UseTimezoneDataArgs) => {
  const memberRows = useMemo((): Array<MemberRow> => {
    if (!viewerTimezone) {
      return [];
    }

    return members.map((member) => {
      const hours = [...EMPTY_HOURS];
      const startInViewerTz = convertHourToTimezone(
        member.workingHoursStart,
        member.timezone,
        viewerTimezone,
      );
      const endInViewerTz = convertHourToTimezone(
        member.workingHoursEnd,
        member.timezone,
        viewerTimezone,
      );

      if (startInViewerTz <= endInViewerTz) {
        for (let h = startInViewerTz; h < endInViewerTz; h++) {
          hours[h] = true;
        }
      } else {
        for (let h = startInViewerTz; h < HOURS_IN_DAY; h++) {
          hours[h] = true;
        }
        for (let h = 0; h < endInViewerTz; h++) {
          hours[h] = true;
        }
      }

      const dayOffset = getDayOffset(member.timezone, viewerTimezone);
      return { dayOffset, hours, member };
    });
  }, [members, viewerTimezone]);

  const memberRowById = useMemo(
    () => new Map(memberRows.map((row) => [row.member.id, row])),
    [memberRows],
  );

  const groupNameById = useMemo(
    () => new Map(groups.map((group) => [group.id, group.name])),
    [groups],
  );

  const groupedSections = useMemo((): Array<GroupedSection> => {
    if (groups.length === 0) {
      return [{ group: null, rows: memberRows }];
    }

    const rowByMemberId = new Map(memberRows.map((row) => [row.member.id, row]));
    const sections: Array<GroupedSection> = [];

    const sortedGroups = [...groups].toSorted((a, b) => a.order - b.order);

    for (const group of sortedGroups) {
      const groupMembers = members.filter((m) => m.groupId === group.id);
      if (groupMembers.length === 0) {
        continue;
      }

      const rows = groupMembers
        .map((m) => rowByMemberId.get(m.id))
        .filter((row): row is MemberRow => row !== undefined);

      sections.push({ group, rows });
    }

    const ungroupedMembers = members.filter((m) => !m.groupId);
    if (ungroupedMembers.length > 0) {
      const rows = ungroupedMembers
        .map((m) => rowByMemberId.get(m.id))
        .filter((row): row is MemberRow => row !== undefined);

      sections.push({ group: null, rows });
    }

    return sections;
  }, [groups, members, memberRows]);

  const validSelections = useMemo(() => {
    return compareSelections.filter((sel) => {
      if (sel.type === "member") {
        return members.some((m) => m.id === sel.id);
      }
      return groups.some((g) => g.id === sel.id);
    });
  }, [compareSelections, members, groups]);

  const selectedMemberIds = useMemo(() => {
    const ids = new Set<string>();

    for (const sel of validSelections) {
      if (sel.type === "member") {
        ids.add(sel.id);
        continue;
      }

      for (const member of members) {
        if (member.groupId === sel.id) {
          ids.add(member.id);
        }
      }
    }

    return ids;
  }, [validSelections, members]);

  const totalPeopleSelected = selectedMemberIds.size;
  const canShowOverlap = totalPeopleSelected >= 2;

  const overlapData = useMemo((): OverlapData => {
    if (!canShowOverlap) {
      return EMPTY_OVERLAP_DATA;
    }

    const allMemberHours: Array<Array<boolean>> = [];
    const selectionCoverage: Array<Array<boolean>> = [];

    for (const sel of validSelections) {
      const selectionHours = Array.from({ length: HOURS_IN_DAY }, () => false);

      if (sel.type === "member") {
        const row = memberRowById.get(sel.id);
        if (row) {
          row.hours.forEach((isWorking, hour) => {
            if (isWorking) {
              selectionHours[hour] = true;
            }
          });
        }
      } else {
        const groupMembers = members.filter((m) => m.groupId === sel.id);
        for (const member of groupMembers) {
          const row = memberRowById.get(member.id);
          if (row) {
            row.hours.forEach((isWorking, hour) => {
              if (isWorking) {
                selectionHours[hour] = true;
              }
            });
          }
        }
      }

      selectionCoverage.push(selectionHours);
    }

    for (const memberId of selectedMemberIds) {
      const row = memberRowById.get(memberId);
      if (row) {
        allMemberHours.push(row.hours);
      }
    }

    if (allMemberHours.length < 2) {
      return EMPTY_OVERLAP_DATA;
    }

    const totalPeople = allMemberHours.length;
    const counts = Array.from(
      { length: HOURS_IN_DAY },
      (_, hour) => allMemberHours.filter((hours) => hours[hour]).length,
    );

    const full = counts.map((count) => count === totalPeople);
    const partial = counts.map((count, hour) => count >= 2 && !full[hour]);
    const crossTeam = counts.map((_, hour) => {
      if (selectionCoverage.length < 2) {
        return false;
      }
      return selectionCoverage.every((hours) => hours[hour]);
    });

    return {
      crossTeamOverlapHours: crossTeam,
      overlapCounts: counts,
      overlapHours: full,
      partialOverlapHours: partial,
    };
  }, [canShowOverlap, validSelections, memberRowById, members, selectedMemberIds]);

  const overlapStatus = useMemo((): OverlapStatus => {
    const { overlapHours, partialOverlapHours } = overlapData;
    const hasFullOverlap = overlapHours.some(Boolean);
    const hasPartialOverlap = partialOverlapHours.some(Boolean);

    if (!hasFullOverlap && !hasPartialOverlap) {
      return "none";
    }
    if (hasFullOverlap && hasPartialOverlap) {
      return "mixed";
    }
    if (hasFullOverlap) {
      return "full";
    }
    return "partial";
  }, [overlapData]);

  const isMemberInCompare = (memberId: string, isComparing: boolean): boolean => {
    if (!isComparing || validSelections.length === 0) {
      return false;
    }

    for (const sel of validSelections) {
      if (sel.type === "member" && sel.id === memberId) {
        return true;
      }
      if (sel.type === "group") {
        const member = members.find((m) => m.id === memberId);
        if (member?.groupId === sel.id) {
          return true;
        }
      }
    }
    return false;
  };

  const addSelection = (
    sel: Selection,
    setCompareSelections: React.Dispatch<React.SetStateAction<Array<Selection>>>,
  ) => {
    setCompareSelections((prev) => {
      const key = serializeSelection(sel);
      if (prev.some((s) => serializeSelection(s) === key)) {
        return prev;
      }
      return [...prev, sel];
    });
  };

  const removeSelection = (
    sel: Selection,
    setCompareSelections: React.Dispatch<React.SetStateAction<Array<Selection>>>,
  ) => {
    setCompareSelections((prev) => {
      const key = serializeSelection(sel);
      return prev.filter((s) => serializeSelection(s) !== key);
    });
  };

  return {
    addSelection,
    canShowOverlap,
    groupedSections,
    groupNameById,
    isMemberInCompare,
    memberRowById,
    memberRows,
    overlapData,
    overlapStatus,
    removeSelection,
    selectedMemberIds,
    totalPeopleSelected,
    validSelections,
  };
};

export { useTimezoneData };
