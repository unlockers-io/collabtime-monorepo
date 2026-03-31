import { describe, expect, it } from "vitest";

import { isTeamRole } from "./index";

describe("isTeamRole", () => {
  it("returns true for ADMIN", () => {
    expect(isTeamRole("ADMIN")).toBe(true);
  });

  it("returns true for MEMBER", () => {
    expect(isTeamRole("MEMBER")).toBe(true);
  });

  it("returns false for unknown string", () => {
    expect(isTeamRole("GUEST")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isTeamRole("")).toBe(false);
  });

  it("returns false for non-string values", () => {
    expect(isTeamRole(null)).toBe(false);
    expect(isTeamRole(undefined)).toBe(false);
    expect(isTeamRole(42)).toBe(false);
    expect(isTeamRole({})).toBe(false);
  });

  it("returns false for lowercase variants", () => {
    expect(isTeamRole("admin")).toBe(false);
    expect(isTeamRole("member")).toBe(false);
  });
});
