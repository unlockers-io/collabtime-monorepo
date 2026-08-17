"use client";

import { convertHourToTimezone, getDayOffset } from "@/lib/timezones";
import type { TeamGroup, TeamMember } from "@/types";

import { EMPTY_HOURS, EMPTY_OVERLAP_DATA, HOURS_IN_DAY, serializeSelection } from "./helpers";
import type {
  GroupedSection,
  HourOverlap,
  MemberRow,
  OverlapData,
  OverlapStatus,
  Selection,
} from "./types";

type GroupIndex = {
  byGroupId: Map<string, Array<TeamMember>>;
  ungrouped: Array<TeamMember>;
};

/**
 * One definition of "in this group", where six call sites each re-decided
 * whether an empty-string groupId counts as ungrouped. Iterates `members` so a
 * group's rows keep the team's own order. A member naming a deleted group lands
 * in neither bucket and so appears in no section, as before.
 */
const indexMembersByGroup = (members: Array<TeamMember>): GroupIndex => {
  const byGroupId = new Map<string, Array<TeamMember>>();
  const ungrouped: Array<TeamMember> = [];

  for (const member of members) {
    if (member.groupId === undefined || member.groupId === "") {
      ungrouped.push(member);
      continue;
    }
    const bucket = byGroupId.get(member.groupId);
    if (bucket) {
      bucket.push(member);
    } else {
      byGroupId.set(member.groupId, [member]);
    }
  }

  return { byGroupId, ungrouped };
};

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
  groupIndex: GroupIndex,
  memberRows: Array<MemberRow>,
): Array<GroupedSection> => {
  if (groups.length === 0) {
    return [{ group: null, rows: memberRows }];
  }

  const rowByMemberId = new Map(memberRows.map((row) => [row.member.id, row]));
  const sections: Array<GroupedSection> = [];

  const toRows = (groupMembers: Array<TeamMember>): Array<MemberRow> =>
    groupMembers.flatMap((m) => {
      const row = rowByMemberId.get(m.id);
      return row === undefined ? [] : [row];
    });

  const sortedGroups = [...groups].toSorted((a, b) => a.order - b.order);

  for (const group of sortedGroups) {
    const groupMembers = groupIndex.byGroupId.get(group.id);
    if (groupMembers === undefined) {
      continue;
    }

    sections.push({ group, rows: toRows(groupMembers) });
  }

  if (groupIndex.ungrouped.length > 0) {
    sections.push({ group: null, rows: toRows(groupIndex.ungrouped) });
  }

  return sections;
};

const toOverlapData = (
  groupIndex: GroupIndex,
  memberRowById: Map<string, MemberRow>,
  selectedMemberIds: Set<string>,
  validSelections: Array<Selection>,
): OverlapData => {
  const allMemberHours: Array<Array<boolean>> = [];
  const selectionCoverage: Array<Array<boolean>> = [];

  for (const sel of validSelections) {
    const selectionHours = Array.from({ length: HOURS_IN_DAY }, () => false);
    const selectionMembers =
      sel.type === "member" ? [sel.id] : (groupIndex.byGroupId.get(sel.id) ?? []).map((m) => m.id);

    for (const memberId of selectionMembers) {
      const row = memberRowById.get(memberId);
      if (!row) {
        continue;
      }
      row.hours.forEach((isWorking, hour) => {
        if (isWorking) {
          selectionHours[hour] = true;
        }
      });
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

  const hours = Array.from<unknown, HourOverlap>({ length: HOURS_IN_DAY }, (_, hour) => {
    const availableCount = allMemberHours.filter((memberHours) => memberHours[hour]).length;
    let coverage: HourOverlap["coverage"] = "none";
    if (availableCount === totalPeople) {
      coverage = "full";
    } else if (availableCount >= 2) {
      coverage = "partial";
    }

    return {
      availableCount,
      coverage,
      isEveryTeamRepresented:
        selectionCoverage.length >= 2 && selectionCoverage.every((covered) => covered[hour]),
    };
  });

  return { hours };
};

const toOverlapStatus = ({ hours }: OverlapData): OverlapStatus => {
  const hasFullOverlap = hours.some((hour) => hour.coverage === "full");
  const hasPartialOverlap = hours.some((hour) => hour.coverage === "partial");

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

  const groupIndex = indexMembersByGroup(members);

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

    for (const member of groupIndex.byGroupId.get(sel.id) ?? []) {
      selectedMemberIds.add(member.id);
    }
  }

  const totalPeopleSelected = selectedMemberIds.size;
  const canShowOverlap = totalPeopleSelected >= 2;

  const overlapData = canShowOverlap
    ? toOverlapData(groupIndex, memberRowById, selectedMemberIds, validSelections)
    : EMPTY_OVERLAP_DATA;

  return {
    canShowOverlap,
    groupedSections: toGroupedSections(groups, groupIndex, memberRows),
    groupNameById,
    memberRowById,
    membersByGroupId: groupIndex.byGroupId,
    overlapData,
    overlapStatus: toOverlapStatus(overlapData),
    selectedMemberIds,
    totalPeopleSelected,
    validSelections,
  };
};

export { addSelection, getTimezoneData, removeSelection };
