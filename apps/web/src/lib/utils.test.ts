import { describe, expect, it } from "vitest";

import { cn, formatHour } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    const condition = false;
    expect(cn("foo", condition && "bar", "baz")).toBe("foo baz");
  });

  it("deduplicates tailwind classes", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });
});

describe("formatHour", () => {
  it("formats single-digit hours with leading zero", () => {
    expect(formatHour(0)).toBe("00:00");
    expect(formatHour(9)).toBe("09:00");
  });

  it("formats double-digit hours", () => {
    expect(formatHour(10)).toBe("10:00");
    expect(formatHour(23)).toBe("23:00");
  });
});
