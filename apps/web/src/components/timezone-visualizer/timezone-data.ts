"use client";

import { convertHourToTimezone, getDayOffset } from "@/lib/timezones";
import type { TeamGroup, TeamMember } from "@/types";

import { EMPTY_HOURS, EMPTY_OVERLAP_DATA, HOURS_IN_DAY, serializeSelection } from "./helpers";
import type { GroupedSection, MemberRow, OverlapData, OverlapStatus, Selection } from "./types";

type TimezoneDataArgs = {
  compareSelections: Array<Selection>;
  groups: Array<TeamGroup>;
  members: Array<TeamMember>;
  viewerTimezone: string;
};

const addSelection = (selections: Array<Selection>, sel: Selection): Array<Selection> => {
  const key = serializeSelection(sel);
  if (selections.some((s) => serializeSelection(s) === key)) {
    return selections;
  }
  return [...selections, sel];
};

const removeSelection = (selections: Array<Selection>, sel: Selection): Array<Selection> => {
  const key = serializeSelection(sel);
  return selections.filter((s) => serializeSelection(s) !== key);
};

const toMemberRow = (member: TeamMember, viewerTimezone: string): MemberRow => {
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
};

const toGroupedSections = (
  groups: Array<TeamGroup>,
  members: Array<TeamMember>,
  memberRows: Array<MemberRow>,
): Array<GroupedSection> => {
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

    const rows: Array<MemberRow> = [];
    for (const m of groupMembers) {
      const row = rowByMemberId.get(m.id);
      if (row !== undefined) {
        rows.push(row);
      }
    }

    sections.push({ group, rows });
  }

  const ungroupedMembers = members.filter((m) => m.groupId === undefined || m.groupId === "");
  if (ungroupedMembers.length > 0) {
    const rows: Array<MemberRow> = [];
    for (const m of ungroupedMembers) {
      const row = rowByMemberId.get(m.id);
      if (row !== undefined) {
        rows.push(row);
      }
    }

    sections.push({ group: null, rows });
  }

  return sections;
};

const toOverlapData = (
  members: Array<TeamMember>,
  memberRowById: Map<string, MemberRow>,
  selectedMemberIds: Set<string>,
  validSelections: Array<Selection>,
): OverlapData => {
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
};

const toOverlapStatus = ({ overlapHours, partialOverlapHours }: OverlapData): OverlapStatus => {
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
};

const getTimezoneData = ({
  compareSelections,
  groups,
  members,
  viewerTimezone,
}: TimezoneDataArgs) => {
  const memberRows =
    viewerTimezone === "" ? [] : members.map((member) => toMemberRow(member, viewerTimezone));

  const memberRowById = new Map(memberRows.map((row) => [row.member.id, row]));

  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  const validSelections = compareSelections.filter((sel) => {
    if (sel.type === "member") {
      return members.some((m) => m.id === sel.id);
    }
    return groups.some((g) => g.id === sel.id);
  });

  const selectedMemberIds = new Set<string>();

  for (const sel of validSelections) {
    if (sel.type === "member") {
      selectedMemberIds.add(sel.id);
      continue;
    }

    for (const member of members) {
      if (member.groupId === sel.id) {
        selectedMemberIds.add(member.id);
      }
    }
  }

  const totalPeopleSelected = selectedMemberIds.size;
  const canShowOverlap = totalPeopleSelected >= 2;

  const overlapData = canShowOverlap
    ? toOverlapData(members, memberRowById, selectedMemberIds, validSelections)
    : EMPTY_OVERLAP_DATA;

  const memberById = new Map(members.map((m) => [m.id, m]));

  const isMemberInCompare = (memberId: string, isComparing: boolean): boolean => {
    if (!isComparing || validSelections.length === 0) {
      return false;
    }

    const member = memberById.get(memberId);
    for (const sel of validSelections) {
      if (sel.type === "member" && sel.id === memberId) {
        return true;
      }
      if (sel.type === "group" && member?.groupId === sel.id) {
        return true;
      }
    }
    return false;
  };

  return {
    canShowOverlap,
    groupedSections: toGroupedSections(groups, members, memberRows),
    groupNameById,
    isMemberInCompare,
    memberRowById,
    memberRows,
    overlapData,
    overlapStatus: toOverlapStatus(overlapData),
    selectedMemberIds,
    totalPeopleSelected,
    validSelections,
  };
};

export { addSelection, getTimezoneData, removeSelection };
