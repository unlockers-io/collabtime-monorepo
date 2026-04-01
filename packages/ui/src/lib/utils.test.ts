import { describe, expect, it } from "vitest";

import { cn } from "./utils";

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

  it("strips ui: prefix for tailwind merge deduplication", () => {
    // Classes with ui: prefix should be treated as equivalent to unprefixed
    const result = cn("ui:p-4", "ui:p-2");
    expect(result).toBe("ui:p-2");
  });

  it("keeps both ui: prefixed and non-prefixed classes", () => {
    // The ui: prefix scoping means prefixed and non-prefixed are distinct
    const result = cn("p-4", "ui:p-2");
    expect(result).toBe("p-4 ui:p-2");
  });

  it("handles mixed ui: and regular classes", () => {
    const result = cn("ui:text-red-500", "flex", "ui:text-blue-500");
    expect(result).toBe("flex ui:text-blue-500");
  });
});
