import {
  MINUTES_IN_DAY,
  getMinuteOfDay,
  getOffsetMinutes,
  getWorkingMinutes,
  wrapMinutes,
} from "@/lib/timezones";
import type { TeamGroup, TeamMember } from "@/types";

// Every real UTC offset is a multiple of 15 minutes, so slots this size
// represent any member's hours in any viewer's frame exactly.
const SLOT_MINUTES = 15;
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;
const SLOTS_IN_DAY = MINUTES_IN_DAY / SLOT_MINUTES;

type WorkingInterval = {
  lengthMinutes: number;
  startMinute: number;
};

type MemberRow = {
  dayOffset: number;
  interval: WorkingInterval;
  isCounted: boolean;
  member: TeamMember;
  /** How far the member's clock runs ahead of the viewer's. */
  shiftMinutes: number;
  /** Viewer-frame working state for each 15-minute slot of the day. */
  slots: ReadonlyArray<boolean>;
};

type GroupedSection = {
  group: TeamGroup | null;
  rows: Array<MemberRow>;
};

type SlotRun = {
  lengthSlots: number;
  startSlot: number;
};

type WindowTiming =
  | { kind: "now"; minutesLeft: number }
  | { isTomorrow: boolean; kind: "later"; minutesUntil: number };

type SharedWindow = SlotRun & {
  availableMemberIds: ReadonlyArray<string>;
};

type TimedRun<T extends SlotRun> = {
  run: T;
  timing: WindowTiming;
};

type SharedWindowReading = {
  bestSlots: ReadonlyArray<boolean>;
  countedCount: number;
  /** Hours where every counted group has at least one person working. */
  groupCoverage: TimedRun<SlotRun> | null;
  primary: TimedRun<SharedWindow> | null;
  windows: ReadonlyArray<SharedWindow>;
};

/** A member whose group no longer exists is ungrouped. */
const isUngrouped = (member: Pick<TeamMember, "groupId">, groupIds: ReadonlySet<string>) =>
  member.groupId === undefined || !groupIds.has(member.groupId);

const EMPTY_SLOTS: ReadonlyArray<boolean> = Object.freeze(
  Array.from<boolean>({ length: SLOTS_IN_DAY }).fill(false),
);

const toSlots = ({ lengthMinutes, startMinute }: WorkingInterval): Array<boolean> =>
  Array.from(
    { length: SLOTS_IN_DAY },
    (_, slot) => wrapMinutes(slot * SLOT_MINUTES - startMinute) < lengthMinutes,
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

  const [first] = runs;
  const last = runs.at(-1);
  if (
    runs.length > 1 &&
    first !== undefined &&
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
  groupIds: ReadonlySet<string>,
  nowMinute: number,
): TimedRun<SlotRun> | null => {
  const groupRows = [...groupIds].flatMap((groupId) => {
    const rows = counted.filter((row) => row.member.groupId === groupId);
    return rows.length > 0 ? [rows] : [];
  });

  if (groupRows.length < 2) {
    return null;
  }

  const keys = Array.from({ length: SLOTS_IN_DAY }, (_, slot) =>
    groupRows.every((rows) => rows.some((row) => row.slots[slot] === true)) ? "covered" : null,
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
  groupIds: ReadonlySet<string>,
  nowMinute: number,
): SharedWindowReading => {
  const counted = rows.filter((row) => row.isCounted);

  if (counted.length < 2) {
    return { ...EMPTY_READING, countedCount: counted.length };
  }

  const counts = Array.from(
    { length: SLOTS_IN_DAY },
    (_, slot) => counted.filter((row) => row.slots[slot] === true).length,
  );
  const peak = Math.max(...counts);
  const groupCoverage = readGroupCoverage(counted, groupIds, nowMinute);

  if (peak < 2) {
    return { ...EMPTY_READING, countedCount: counted.length, groupCoverage };
  }

  const bestSlots = counts.map((count) => count === peak);
  const keys = bestSlots.map((isBest, slot) =>
    isBest
      ? counted.flatMap((row) => (row.slots[slot] === true ? [row.member.id] : [])).join(",")
      : null,
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

const toGroupedSections = (
  groups: ReadonlyArray<TeamGroup>,
  groupIds: ReadonlySet<string>,
  rows: ReadonlyArray<MemberRow>,
): Array<GroupedSection> => {
  if (groups.length === 0) {
    return [{ group: null, rows: [...rows] }];
  }

  const sections: Array<GroupedSection> = [...groups]
    .toSorted((a, b) => a.order - b.order)
    .flatMap((group) => {
      const groupRows = rows.filter((row) => row.member.groupId === group.id);
      return groupRows.length > 0 ? [{ group, rows: groupRows }] : [];
    });

  const ungrouped = rows.filter((row) => isUngrouped(row.member, groupIds));
  if (ungrouped.length > 0) {
    sections.push({ group: null, rows: ungrouped });
  }

  return sections;
};

type TeamScheduleArgs = {
  collapsedGroupIds: ReadonlySet<string>;
  excludedMemberIds: ReadonlySet<string>;
  groups: ReadonlyArray<TeamGroup>;
  members: ReadonlyArray<TeamMember>;
  now: Date;
  viewerTimezone: string;
};

/**
 * Places every member's working hours on the viewer's day at `now`. Hours are
 * stored as whole hours in the member's own zone, so a half-hour offset such
 * as Asia/Kolkata lands on :30 in the viewer's frame.
 */
const getTeamSchedule = ({
  collapsedGroupIds,
  excludedMemberIds,
  groups,
  members,
  now,
  viewerTimezone,
}: TeamScheduleArgs) => {
  const groupIds = new Set(groups.map((group) => group.id));
  const nowMinute = getMinuteOfDay(viewerTimezone, now);
  const viewerOffset = getOffsetMinutes(viewerTimezone, now);

  const rows: Array<MemberRow> = members.map((member) => {
    const shiftMinutes = getOffsetMinutes(member.timezone, now) - viewerOffset;
    const interval = {
      lengthMinutes: getWorkingMinutes(member),
      startMinute: wrapMinutes(member.workingHoursStart * 60 - shiftMinutes),
    };
    const isInCollapsedGroup =
      !isUngrouped(member, groupIds) && collapsedGroupIds.has(member.groupId ?? "");
    return {
      dayOffset: Math.floor((nowMinute + shiftMinutes) / MINUTES_IN_DAY),
      interval,
      isCounted: !excludedMemberIds.has(member.id) && !isInCollapsedGroup,
      member,
      shiftMinutes,
      slots: toSlots(interval),
    };
  });

  return {
    groupedSections: toGroupedSections(groups, groupIds, rows),
    nowMinute,
    reading: readSharedWindow(rows, groupIds, nowMinute),
    rows,
  };
};

export { SLOTS_PER_HOUR, SLOT_MINUTES, getTeamSchedule, isUngrouped };

export type { MemberRow, SharedWindowReading, SlotRun, WindowTiming };
