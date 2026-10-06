import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { TeamGroup, TeamMember } from "@/types";

import { useCollapsedGroups } from "./use-collapsed-groups";

const COLLAPSED_GROUPS_KEY = "collabtime-collapsed-groups:v1";
const GROUPS: Array<TeamGroup> = [{ id: "product", name: "Product", order: 0 }];

const member = (id: string, groupId: string): TeamMember => ({
  groupId,
  id,
  name: id,
  order: 0,
  timezone: "UTC",
  title: "",
  workingHoursEnd: 17,
  workingHoursStart: 9,
});

afterEach(() => {
  localStorage.clear();
});

describe("useCollapsedGroups", () => {
  it("keeps the last visible group open", () => {
    const { result } = renderHook(() => useCollapsedGroups([member("a", "product")], GROUPS));

    act(() => {
      result.current.toggleGroupCollapse("product");
    });

    expect(result.current.collapsedGroupIds).toEqual([]);
  });

  it("counts a member of a deleted group as ungrouped and still visible", () => {
    localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(["deleted"]));
    const members = [member("a", "product"), member("b", "deleted")];
    const { result } = renderHook(() => useCollapsedGroups(members, GROUPS));

    act(() => {
      result.current.toggleGroupCollapse("product");
    });

    expect(result.current.collapsedGroupIds).toContain("product");
  });
});
