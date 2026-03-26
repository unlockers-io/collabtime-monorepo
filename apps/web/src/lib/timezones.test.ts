import { describe, expect, it } from "vitest";

import {
  COMMON_TIMEZONES,
  convertHourToTimezone,
  formatTimeUntilAvailable,
  fuzzyMatchTimezone,
} from "./timezones";

describe("convertHourToTimezone", () => {
  it("converts between same timezone", () => {
    expect(convertHourToTimezone(9, "America/New_York", "America/New_York")).toBe(9);
  });

  it("wraps around midnight going forward", () => {
    // Converting a late hour east should wrap past 24
    const result = convertHourToTimezone(23, "America/New_York", "Europe/London");
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(24);
  });

  it("wraps around midnight going backward", () => {
    // Converting an early hour west should wrap below 0
    const result = convertHourToTimezone(0, "Europe/London", "America/New_York");
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(24);
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
