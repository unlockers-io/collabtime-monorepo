import type { WorkingInterval } from "@/lib/timezones";
import type { TeamGroup, TeamMember } from "@/types";

type MemberRow = {
  dayOffset: number;
  interval: WorkingInterval;
  isCounted: boolean;
  member: TeamMember;
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

export type {
  GroupedSection,
  MemberRow,
  SharedWindow,
  SharedWindowReading,
  SlotRun,
  TimedRun,
  WindowTiming,
};
