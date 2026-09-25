import {
  MINUTES_IN_DAY,
  getDayOffset,
  getWorkingInterval,
  isMinuteInInterval,
  wrapMinutes,
} from "@/lib/timezones";
import type { TeamGroup, TeamMember } from "@/types";

import type {
  GroupedSection,
  MemberRow,
  SharedWindow,
  SharedWindowReading,
  SlotRun,
  TimedRun,
  WindowTiming,
} from "./types";

// Every real UTC offset is a multiple of 15 minutes, so slots this size
// represent any member's hours in any viewer's frame exactly.
const SLOT_MINUTES = 15;
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;
const SLOTS_IN_DAY = MINUTES_IN_DAY / SLOT_MINUTES;

const EMPTY_SLOTS: ReadonlyArray<boolean> = Object.freeze(
  Array.from<boolean>({ length: SLOTS_IN_DAY }).fill(false),
);

const toSlots = (row: Pick<MemberRow, "interval">): Array<boolean> =>
  Array.from({ length: SLOTS_IN_DAY }, (_, slot) =>
    isMinuteInInterval(slot * SLOT_MINUTES, row.interval),
  );

type KeyedRun = SlotRun & { key: string };

/** Groups consecutive slots sharing a key, joining a run that crosses midnight. */
const toRuns = (keys: ReadonlyArray<string | null>): Array<KeyedRun> => {
  const runs: Array<KeyedRun> = [];

  keys.forEach((key, slot) => {
    if (key === null) {
      return;
    }
    const last = runs.at(-1);
    if (last?.key === key && last.startSlot + last.lengthSlots === slot) {
      last.lengthSlots += 1;
      return;
    }
    runs.push({ key, lengthSlots: 1, startSlot: slot });
  });

  const first = runs[0];
  const last = runs.at(-1);
  if (
    runs.length > 1 &&
    last !== undefined &&
    first.startSlot === 0 &&
    last.startSlot + last.lengthSlots === SLOTS_IN_DAY &&
    first.key === last.key
  ) {
    last.lengthSlots += first.lengthSlots;
    runs.shift();
  }

  return runs;
};

const getTiming = (run: SlotRun, nowMinute: number): WindowTiming => {
  const startMinute = run.startSlot * SLOT_MINUTES;
  const lengthMinutes = run.lengthSlots * SLOT_MINUTES;
  const sinceStart = wrapMinutes(nowMinute - startMinute);

  if (sinceStart < lengthMinutes) {
    return { kind: "now", minutesLeft: lengthMinutes - sinceStart };
  }

  const minutesUntil = wrapMinutes(startMinute - nowMinute);
  return { isTomorrow: nowMinute + minutesUntil >= MINUTES_IN_DAY, kind: "later", minutesUntil };
};

/** The run happening now, otherwise the soonest one to start. */
const pickUpcoming = <T extends SlotRun>(
  runs: ReadonlyArray<T>,
  nowMinute: number,
): TimedRun<T> | null => {
  let best: TimedRun<T> | null = null;
  let bestRank = Infinity;

  for (const run of runs) {
    const timing = getTiming(run, nowMinute);
    const rank = timing.kind === "now" ? -1 : timing.minutesUntil;
    if (rank < bestRank) {
      best = { run, timing };
      bestRank = rank;
    }
  }

  return best;
};

const readGroupCoverage = (
  counted: ReadonlyArray<MemberRow>,
  nowMinute: number,
): TimedRun<SlotRun> | null => {
  const rowsByGroup = new Map<string, Array<MemberRow>>();
  for (const row of counted) {
    const { groupId } = row.member;
    if (groupId === undefined || groupId === "") {
      continue;
    }
    rowsByGroup.set(groupId, [...(rowsByGroup.get(groupId) ?? []), row]);
  }

  if (rowsByGroup.size < 2) {
    return null;
  }

  const groupRows = [...rowsByGroup.values()];
  const keys = Array.from({ length: SLOTS_IN_DAY }, (_, slot) =>
    groupRows.every((rows) => rows.some((row) => row.slots[slot])) ? "covered" : null,
  );

  return pickUpcoming(toRuns(keys), nowMinute);
};

const EMPTY_READING: SharedWindowReading = Object.freeze({
  bestSlots: EMPTY_SLOTS,
  countedCount: 0,
  groupCoverage: null,
  primary: null,
  windows: Object.freeze([]),
});

/**
 * Best slots are where the most counted people work at once (at least two).
 * A window splits when the people free change, so each one names who is free.
 */
const readSharedWindow = (
  rows: ReadonlyArray<MemberRow>,
  nowMinute: number,
): SharedWindowReading => {
  const counted = rows.filter((row) => row.isCounted);

  if (counted.length < 2) {
    return { ...EMPTY_READING, countedCount: counted.length };
  }

  const counts = Array.from(
    { length: SLOTS_IN_DAY },
    (_, slot) => counted.filter((row) => row.slots[slot]).length,
  );
  const peak = Math.max(...counts);
  const groupCoverage = readGroupCoverage(counted, nowMinute);

  if (peak < 2) {
    return { ...EMPTY_READING, countedCount: counted.length, groupCoverage };
  }

  const bestSlots = counts.map((count) => count === peak);
  const keys = bestSlots.map((isBest, slot) =>
    isBest ? counted.flatMap((row) => (row.slots[slot] ? [row.member.id] : [])).join(",") : null,
  );
  const windows: Array<SharedWindow> = toRuns(keys).map(({ key, lengthSlots, startSlot }) => ({
    availableMemberIds: key.split(","),
    lengthSlots,
    startSlot,
  }));

  return {
    bestSlots,
    countedCount: counted.length,
    groupCoverage,
    primary: pickUpcoming(windows, nowMinute),
    windows,
  };
};

const isGrouped = (member: TeamMember, groupIds: ReadonlySet<string>): boolean =>
  member.groupId !== undefined && member.groupId !== "" && groupIds.has(member.groupId);

const toGroupedSections = (
  groups: ReadonlyArray<TeamGroup>,
  rows: ReadonlyArray<MemberRow>,
): Array<GroupedSection> => {
  if (groups.length === 0) {
    return [{ group: null, rows: [...rows] }];
  }

  const groupIds = new Set(groups.map((group) => group.id));
  const sections: Array<GroupedSection> = [...groups]
    .toSorted((a, b) => a.order - b.order)
    .flatMap((group) => {
      const groupRows = rows.filter((row) => row.member.groupId === group.id);
      return groupRows.length > 0 ? [{ group, rows: groupRows }] : [];
    });

  const ungrouped = rows.filter((row) => !isGrouped(row.member, groupIds));
  if (ungrouped.length > 0) {
    sections.push({ group: null, rows: ungrouped });
  }

  return sections;
};

type TimezoneDataArgs = {
  collapsedGroupIds: ReadonlySet<string>;
  excludedMemberIds: ReadonlySet<string>;
  groups: ReadonlyArray<TeamGroup>;
  members: ReadonlyArray<TeamMember>;
  now: Date;
  nowMinute: number;
  viewerTimezone: string;
};

const getTimezoneData = ({
  collapsedGroupIds,
  excludedMemberIds,
  groups,
  members,
  now,
  nowMinute,
  viewerTimezone,
}: TimezoneDataArgs) => {
  const groupIds = new Set(groups.map((group) => group.id));

  const rows: Array<MemberRow> = members.map((member) => {
    const interval = getWorkingInterval(member, viewerTimezone, now);
    const isInCollapsedGroup =
      isGrouped(member, groupIds) && collapsedGroupIds.has(member.groupId ?? "");
    return {
      dayOffset: getDayOffset(member.timezone, viewerTimezone),
      interval,
      isCounted: !excludedMemberIds.has(member.id) && !isInCollapsedGroup,
      member,
      slots: toSlots({ interval }),
    };
  });

  return {
    groupedSections: toGroupedSections(groups, rows),
    reading: readSharedWindow(rows, nowMinute),
    rows,
  };
};

export { SLOTS_IN_DAY, SLOTS_PER_HOUR, SLOT_MINUTES, getTimezoneData, toRuns };
