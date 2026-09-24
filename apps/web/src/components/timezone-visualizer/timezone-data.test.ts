import { describe, expect, it } from "vitest";

import type { TeamMember } from "@/types";

import { SLOTS_IN_DAY, SLOT_MINUTES, getTimezoneData, toRuns } from "./timezone-data";

// January keeps every zone below on standard time.
const NOW = new Date("2026-01-15T13:00:00Z");
const VIEWER = "America/Sao_Paulo";
// 13:00 UTC is 10:00 in São Paulo.
const NOW_MINUTE = 10 * 60;

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

const read = (
  members: Array<TeamMember>,
  { collapsed = [], excluded = [] }: { collapsed?: Array<string>; excluded?: Array<string> } = {},
) =>
  getTimezoneData({
    collapsedGroupIds: new Set(collapsed),
    excludedMemberIds: new Set(excluded),
    groups: [
      { id: "product", name: "Product", order: 0 },
      { id: "engineering", name: "Engineering", order: 1 },
    ],
    members,
    now: NOW,
    nowMinute: NOW_MINUTE,
    viewerTimezone: VIEWER,
  });

const minutesOf = (run: { lengthSlots: number; startSlot: number }) => [
  run.startSlot * SLOT_MINUTES,
  (run.startSlot + run.lengthSlots) * SLOT_MINUTES,
];

describe("toRuns", () => {
  it("joins a run that crosses midnight", () => {
    const keys = Array.from({ length: SLOTS_IN_DAY }, (_, slot) =>
      slot < 4 || slot >= SLOTS_IN_DAY - 4 ? "a" : null,
    );
    expect(toRuns(keys)).toEqual([{ key: "a", lengthSlots: 8, startSlot: SLOTS_IN_DAY - 4 }]);
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
    expect(minutesOf(reading.primary?.run ?? { lengthSlots: 0, startSlot: 0 })).toEqual([
      9 * 60,
      10 * 60 + 30,
    ]);
    expect(reading.primary?.timing).toEqual({ kind: "now", minutesLeft: 30 });
  });

  it("recomputes for the people counted", () => {
    const { reading } = read(team, { excluded: ["kolkata"] });
    expect(reading.countedCount).toBe(2);
    expect(minutesOf(reading.primary?.run ?? { lengthSlots: 0, startSlot: 0 })).toEqual([
      9 * 60,
      14 * 60,
    ]);
  });

  it("leaves collapsed groups out of the count", () => {
    const { reading } = read(team, { collapsed: ["product"] });
    expect(reading.countedCount).toBe(1);
    expect(reading.primary).toBeNull();
  });

  it("names the next window once today's has passed", () => {
    const { reading } = getTimezoneData({
      collapsedGroupIds: new Set(),
      excludedMemberIds: new Set(),
      groups: [],
      members: team,
      now: NOW,
      nowMinute: 11 * 60,
      viewerTimezone: VIEWER,
    });
    expect(reading.primary?.timing).toEqual({
      isTomorrow: true,
      kind: "later",
      minutesUntil: 22 * 60,
    });
  });

  it("reports hours where every group has someone working", () => {
    const { reading } = read(team);
    expect(minutesOf(reading.groupCoverage?.run ?? { lengthSlots: 0, startSlot: 0 })).toEqual([
      5 * 60,
      10 * 60 + 30,
    ]);
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
