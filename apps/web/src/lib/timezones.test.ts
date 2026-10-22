import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COMMON_TIMEZONES,
  formatMinuteOfDay,
  formatMinuteRange,
  formatTimezoneLabel,
  formatUtcOffset,
  fuzzyMatchTimezone,
  getMemberStatus,
  getMinuteOfDay,
  getOffsetMinutes,
  getWorkingMinutes,
} from "./timezones";

// A January date keeps these free of daylight-saving shifts in every zone used.
const AT = new Date("2026-01-15T14:20:00Z");

afterEach(() => {
  vi.useRealTimers();
});

describe("getOffsetMinutes", () => {
  it("reads whole, half, and quarter hour offsets", () => {
    expect(getOffsetMinutes("America/Sao_Paulo", AT)).toBe(-180);
    expect(getOffsetMinutes("Asia/Kolkata", AT)).toBe(330);
    expect(getOffsetMinutes("Asia/Kathmandu", AT)).toBe(345);
    expect(getOffsetMinutes("UTC", AT)).toBe(0);
  });
});

describe("getWorkingMinutes", () => {
  it("runs an end hour earlier than the start past midnight", () => {
    expect(getWorkingMinutes({ workingHoursEnd: 17, workingHoursStart: 9 })).toBe(8 * 60);
    expect(getWorkingMinutes({ workingHoursEnd: 6, workingHoursStart: 22 })).toBe(8 * 60);
  });
});

const kolkata = (workingHoursStart: number, workingHoursEnd: number) => ({
  timezone: "Asia/Kolkata",
  workingHoursEnd,
  workingHoursStart,
});

describe("getMemberStatus", () => {
  // 14:20 UTC is 19:50 in Kolkata.
  it("counts the minutes left in a half-hour zone exactly", () => {
    expect(getMinuteOfDay("Asia/Kolkata", AT)).toBe(19 * 60 + 50);
    expect(getMemberStatus(kolkata(10, 20), AT)).toEqual({ kind: "working", minutesLeft: 10 });
  });

  it("counts the minutes until an off member starts", () => {
    expect(getMemberStatus(kolkata(21, 23), AT)).toEqual({ kind: "off", minutesUntilStart: 70 });
    expect(getMemberStatus(kolkata(9, 17), AT)).toEqual({
      kind: "off",
      minutesUntilStart: 13 * 60 + 10,
    });
  });

  it("keeps an overnight shift working past midnight", () => {
    expect(getMemberStatus(kolkata(19, 3), AT)).toEqual({
      kind: "working",
      minutesLeft: 7 * 60 + 10,
    });
  });
});

describe("formatting", () => {
  it("formats offsets and ranges", () => {
    expect(formatUtcOffset("Asia/Kolkata", AT)).toBe("UTC+5:30");
    expect(formatUtcOffset("America/Sao_Paulo", AT)).toBe("UTC-3");
    expect(formatUtcOffset("UTC", AT)).toBe("UTC");
    expect(formatTimezoneLabel("America/Sao_Paulo", AT)).toBe("Sao Paulo (UTC-3)");
    expect(formatMinuteRange(22 * 60, 24 * 60)).toBe("22:00 – 24:00");
    expect(formatMinuteOfDay(-30)).toBe("23:30");
  });
});

describe("fuzzyMatchTimezone", () => {
  it("returns exact match for common timezone", () => {
    expect(fuzzyMatchTimezone("America/New_York")).toBe("America/New_York");
  });

  it("returns closest match for valid non-common timezone", () => {
    const result = fuzzyMatchTimezone("America/Detroit");
    expect(result).not.toBeNull();
    expect(COMMON_TIMEZONES).toContain(result);
  });

  it("matches by offsets on both sides of daylight saving, whatever the date", () => {
    vi.useFakeTimers({ toFake: ["Date"] });

    for (const date of ["2026-01-15", "2026-07-15"]) {
      vi.setSystemTime(new Date(`${date}T12:00:00Z`));
      expect(fuzzyMatchTimezone("Australia/Adelaide")).toBe("Australia/Sydney");
    }
  });

  it("returns null for invalid timezone", () => {
    expect(fuzzyMatchTimezone("Invalid/Timezone")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(fuzzyMatchTimezone("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(fuzzyMatchTimezone("   ")).toBeNull();
  });
});
