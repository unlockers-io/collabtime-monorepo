import { describe, expect, it } from "vitest";

import {
  COMMON_TIMEZONES,
  formatMinuteOfDay,
  formatMinuteRange,
  formatTimeUntilAvailable,
  formatUtcOffset,
  fuzzyMatchTimezone,
  getMinuteOfDay,
  getMinutesUntilAvailable,
  getMinutesUntilDayEnds,
  getOffsetMinutes,
  getWorkingInterval,
  isCurrentlyWorking,
  isMinuteInInterval,
} from "./timezones";

// A January date keeps these free of daylight-saving shifts in every zone used.
const AT = new Date("2026-01-15T14:20:00Z");

describe("getOffsetMinutes", () => {
  it("reads whole, half, and quarter hour offsets", () => {
    expect(getOffsetMinutes("America/Sao_Paulo", AT)).toBe(-180);
    expect(getOffsetMinutes("Asia/Kolkata", AT)).toBe(330);
    expect(getOffsetMinutes("Asia/Kathmandu", AT)).toBe(345);
    expect(getOffsetMinutes("UTC", AT)).toBe(0);
  });
});

describe("getWorkingInterval", () => {
  it("keeps a half-hour offset on the half hour instead of rounding it", () => {
    const interval = getWorkingInterval(
      { timezone: "Asia/Kolkata", workingHoursEnd: 19, workingHoursStart: 10 },
      "America/Sao_Paulo",
      AT,
    );
    expect(interval).toEqual({ lengthMinutes: 9 * 60, startMinute: 90 });
    expect(
      formatMinuteRange(interval.startMinute, interval.startMinute + interval.lengthMinutes),
    ).toBe("01:30 – 10:30");
  });

  it("wraps hours that cross the viewer's midnight", () => {
    const interval = getWorkingInterval(
      { timezone: "Asia/Tokyo", workingHoursEnd: 18, workingHoursStart: 10 },
      "America/Sao_Paulo",
      AT,
    );
    expect(interval.startMinute).toBe(22 * 60);
    expect(isMinuteInInterval(23 * 60, interval)).toBe(true);
    expect(isMinuteInInterval(5 * 60 + 59, interval)).toBe(true);
    expect(isMinuteInInterval(6 * 60, interval)).toBe(false);
  });

  it("treats an overnight shift in the member's own zone as one block", () => {
    const interval = getWorkingInterval(
      { timezone: "UTC", workingHoursEnd: 6, workingHoursStart: 22 },
      "UTC",
      AT,
    );
    expect(interval).toEqual({ lengthMinutes: 8 * 60, startMinute: 22 * 60 });
  });
});

describe("member clock", () => {
  it("counts the minutes left in a half-hour zone exactly", () => {
    // 14:20 UTC is 19:50 in Kolkata.
    expect(getMinuteOfDay("Asia/Kolkata", AT)).toBe(19 * 60 + 50);
    expect(isCurrentlyWorking("Asia/Kolkata", 10, 20, AT)).toBe(true);
    expect(getMinutesUntilDayEnds("Asia/Kolkata", 20, AT)).toBe(10);
    expect(getMinutesUntilAvailable("Asia/Kolkata", 21, 23, AT)).toBe(70);
  });
});

describe("formatting", () => {
  it("formats offsets and ranges", () => {
    expect(formatUtcOffset("Asia/Kolkata", AT)).toBe("UTC+5:30");
    expect(formatUtcOffset("America/Sao_Paulo", AT)).toBe("UTC-3");
    expect(formatUtcOffset("UTC", AT)).toBe("UTC");
    expect(formatMinuteRange(22 * 60, 24 * 60)).toBe("22:00 – 24:00");
    expect(formatMinuteOfDay(-30)).toBe("23:30");
  });
});

describe("formatTimeUntilAvailable", () => {
  it("returns 'Available now' for 0 minutes", () => {
    expect(formatTimeUntilAvailable(0)).toBe("Available now");
  });

  it("formats minutes only", () => {
    expect(formatTimeUntilAvailable(30)).toBe("in 30m");
  });

  it("formats hours only", () => {
    expect(formatTimeUntilAvailable(120)).toBe("in 2h");
  });

  it("formats hours and minutes", () => {
    expect(formatTimeUntilAvailable(90)).toBe("in 1h 30m");
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
