import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("block", "relative")).toBe("block relative");
  });

  it("handles conditional classes", () => {
    const condition = false;
    expect(cn("block", condition && "relative", "isolate")).toBe("block isolate");
  });

  it("deduplicates tailwind classes", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });
});
