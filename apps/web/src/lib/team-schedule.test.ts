import { afterEach, describe, expect, it, vi } from "vitest";

import { formatMinuteRange } from "@/lib/timezones";
import type { TeamGroup, TeamMember } from "@/types";

import { SLOT_MINUTES, getTeamSchedule } from "./team-schedule";

// January keeps every zone below on standard time.
const NOW = new Date("2026-01-15T13:00:00Z");
const VIEWER = "America/Sao_Paulo";
const GROUPS: Array<TeamGroup> = [
  { id: "product", name: "Product", order: 0 },
  { id: "engineering", name: "Engineering", order: 1 },
];

const member = (
  id: string,
  timezone: string,
  [workingHoursStart, workingHoursEnd]: [number, number],
  groupId?: string,
): TeamMember => {
  const base: TeamMember = {
    id,
    name: id,
    order: 0,
    timezone,
    title: "",
    workingHoursEnd,
    workingHoursStart,
  };
  if (groupId !== undefined) {
    base.groupId = groupId;
  }
  return base;
};

type ReadOptions = {
  collapsed?: Array<string>;
  excluded?: Array<string>;
  groups?: Array<TeamGroup>;
  now?: Date;
  viewer?: string;
};

const read = (
  members: Array<TeamMember>,
  { collapsed = [], excluded = [], groups = GROUPS, now = NOW, viewer = VIEWER }: ReadOptions = {},
) =>
  getTeamSchedule({
    collapsedGroupIds: new Set(collapsed),
    excludedMemberIds: new Set(excluded),
    groups,
    members,
    now,
    viewerTimezone: viewer,
  });

const minutesOf = (run: { lengthSlots: number; startSlot: number } | undefined) =>
  run === undefined
    ? null
    : [run.startSlot * SLOT_MINUTES, (run.startSlot + run.lengthSlots) * SLOT_MINUTES];

const rowOf = (schedule: ReturnType<typeof read>, id: string) =>
  schedule.rows.find((row) => row.member.id === id);

afterEach(() => {
  vi.useRealTimers();
});

describe("member rows", () => {
  it("keeps a half-hour offset on the half hour instead of rounding it", () => {
    const row = rowOf(read([member("kolkata", "Asia/Kolkata", [10, 19])]), "kolkata");
    expect(row?.interval).toEqual({ lengthMinutes: 9 * 60, startMinute: 90 });
    expect(row?.shiftMinutes).toBe(8 * 60 + 30);
  });

  it("wraps hours that cross the viewer's midnight", () => {
    const row = rowOf(read([member("tokyo", "Asia/Tokyo", [10, 18])]), "tokyo");
    expect(row?.interval.startMinute).toBe(22 * 60);
    expect(row?.slots[(23 * 60) / SLOT_MINUTES]).toBe(true);
    expect(row?.slots[(5 * 60 + 45) / SLOT_MINUTES]).toBe(true);
    expect(row?.slots[(6 * 60) / SLOT_MINUTES]).toBe(false);
  });

  it("treats an overnight shift in the member's own zone as one block", () => {
    const row = rowOf(read([member("night", "UTC", [22, 6])], { viewer: "UTC" }), "night");
    expect(row?.interval).toEqual({ lengthMinutes: 8 * 60, startMinute: 22 * 60 });
  });

  it("reads the viewer's minute and every day offset from the given instant", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // On the real clock New York and Tokyo share a date.
    vi.setSystemTime(new Date("2026-03-10T14:00:00Z"));
    const team = [
      member("tokyo", "Asia/Tokyo", [9, 17]),
      member("ny", "America/New_York", [9, 17]),
    ];
    // 15:30 UTC is 00:30 on Jan 16 in Tokyo and 10:30 on Jan 15 in New York.
    const now = new Date("2026-01-15T15:30:00Z");

    const fromNewYork = read(team, { now, viewer: "America/New_York" });
    expect(fromNewYork.nowMinute).toBe(10 * 60 + 30);
    expect(rowOf(fromNewYork, "tokyo")?.dayOffset).toBe(1);
    expect(rowOf(fromNewYork, "ny")?.dayOffset).toBe(0);

    const fromTokyo = read(team, { now, viewer: "Asia/Tokyo" });
    expect(fromTokyo.nowMinute).toBe(30);
    expect(rowOf(fromTokyo, "ny")?.dayOffset).toBe(-1);
  });

  it("places hours and the row shift with the same offsets across a daylight saving change", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
    // New York has moved to daylight time; London has not.
    const now = new Date("2026-03-08T12:00:00Z");
    const row = rowOf(
      read([member("london", "Europe/London", [9, 17])], { now, viewer: "America/New_York" }),
      "london",
    );

    expect(row?.shiftMinutes).toBe(4 * 60);
    expect(row?.interval.startMinute).toBe(5 * 60);
    const start = row?.interval.startMinute ?? 0;
    const shift = row?.shiftMinutes ?? 0;
    expect(formatMinuteRange(start + shift, start + shift + 8 * 60)).toBe("09:00 – 17:00");
  });
});

describe("shared window", () => {
  const team = [
    member("sp", "America/Sao_Paulo", [9, 17], "product"),
    member("berlin", "Europe/Berlin", [9, 18], "product"),
    member("kolkata", "Asia/Kolkata", [10, 19], "engineering"),
  ];

  it("ends the window on the half hour for a half-hour zone", () => {
    const { reading } = read(team);
    // Berlin 09-18 is 05-14 in São Paulo, Kolkata 10-19 is 01:30-10:30.
    expect(reading.primary?.run.availableMemberIds).toEqual(["sp", "berlin", "kolkata"]);
    expect(minutesOf(reading.primary?.run)).toEqual([9 * 60, 10 * 60 + 30]);
    expect(reading.primary?.timing).toEqual({ kind: "now", minutesLeft: 30 });
  });

  it("joins a window that crosses midnight", () => {
    const { reading } = read([
      member("sp", "America/Sao_Paulo", [22, 2]),
      member("buenos-aires", "America/Argentina/Buenos_Aires", [21, 3]),
    ]);
    expect(reading.windows).toHaveLength(1);
    expect(minutesOf(reading.windows[0])).toEqual([22 * 60, 26 * 60]);
  });

  it("recomputes for the people counted", () => {
    const { reading } = read(team, { excluded: ["kolkata"] });
    expect(reading.countedCount).toBe(2);
    expect(minutesOf(reading.primary?.run)).toEqual([9 * 60, 14 * 60]);
  });

  it("leaves collapsed groups out of the count", () => {
    const { reading } = read(team, { collapsed: ["product"] });
    expect(reading.countedCount).toBe(1);
    expect(reading.primary).toBeNull();
  });

  it("names the next window once today's has passed", () => {
    // 14:00 UTC is 11:00 in São Paulo.
    const { reading } = read(team, { groups: [], now: new Date("2026-01-15T14:00:00Z") });
    expect(reading.primary?.timing).toEqual({
      isTomorrow: true,
      kind: "later",
      minutesUntil: 22 * 60,
    });
  });

  it("reports hours where every group has someone working", () => {
    const { reading } = read(team);
    expect(minutesOf(reading.groupCoverage?.run)).toEqual([5 * 60, 10 * 60 + 30]);
  });

  it("finds no window when nobody overlaps", () => {
    const { reading } = read([
      member("sp", "America/Sao_Paulo", [9, 12]),
      member("tokyo", "Asia/Tokyo", [9, 12]),
    ]);
    expect(reading.windows).toEqual([]);
    expect(reading.bestSlots.some(Boolean)).toBe(false);
  });
});

describe("a member whose group was deleted", () => {
  const team = [
    member("sp", "America/Sao_Paulo", [9, 17], "product"),
    member("kolkata", "Asia/Kolkata", [10, 19], "engineering"),
    member("tokyo", "Asia/Tokyo", [9, 17], "deleted"),
  ];

  it("is listed and counted as ungrouped", () => {
    const schedule = read(team, { collapsed: ["deleted"] });
    expect(
      schedule.groupedSections.map((section) => [
        section.group?.id ?? null,
        section.rows.map((row) => row.member.id),
      ]),
    ).toEqual([
      ["product", ["sp"]],
      ["engineering", ["kolkata"]],
      [null, ["tokyo"]],
    ]);
    expect(rowOf(schedule, "tokyo")?.isCounted).toBe(true);
  });

  it("does not add a group that must be covered", () => {
    const { reading } = read(team);
    // Tokyo 09-17 is 21-05 in São Paulo, so a phantom group would empty the coverage.
    expect(minutesOf(reading.groupCoverage?.run)).toEqual([9 * 60, 10 * 60 + 30]);
  });
});
