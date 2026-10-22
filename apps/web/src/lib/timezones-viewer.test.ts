import { afterEach, describe, expect, it, vi } from "vitest";

import { COMMON_TIMEZONES, DEFAULT_MEMBER_TIMEZONE, getUserTimezone } from "./timezones";

const NativeDateTimeFormat = Intl.DateTimeFormat;

const useViewerZone = (zone: string) => {
  const resolved = new NativeDateTimeFormat().resolvedOptions();
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
    ...resolved,
    timeZone: zone,
  });
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("viewer timezone", () => {
  it.each(["2026-01-15", "2026-07-15"])("matches supported and equivalent zones on %s", (date) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${date}T12:00:00Z`));
    useViewerZone("Asia/Singapore");
    expect(getUserTimezone()).toBe("Asia/Singapore");
    useViewerZone("America/Detroit");
    expect(getUserTimezone()).toBe("America/New_York");
  });

  it("falls back for an invalid timezone", () => {
    useViewerZone("Invalid/Zone");
    expect(getUserTimezone()).toBe(DEFAULT_MEMBER_TIMEZONE);
  });

  it("contains only valid, unique IANA zones", () => {
    expect(new Set(COMMON_TIMEZONES).size).toBe(COMMON_TIMEZONES.length);

    for (const timeZone of COMMON_TIMEZONES) {
      expect(() => new NativeDateTimeFormat("en", { timeZone })).not.toThrow();
    }
  });
});
