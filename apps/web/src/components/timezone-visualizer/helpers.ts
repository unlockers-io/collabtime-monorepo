import { useSyncExternalStore } from "react";

import type { TeamGroup } from "@/types";

const HOURS_IN_DAY = 24;
const TIME_AXIS_HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];
const MOBILE_TIME_AXIS_HOURS = new Set([0, 6, 12, 18, 24]);
const EMPTY_GROUPS: Array<TeamGroup> = [];
const EMPTY_IDS: Array<string> = [];

const getEdgeAlignment = (
  isFirst: boolean,
  isLast: boolean,
): "flex-start" | "flex-end" | "center" => {
  if (isFirst) {
    return "flex-start";
  }
  if (isLast) {
    return "flex-end";
  }
  return "center";
};

const formatDayOffset = (offset: number): string | null => {
  if (offset === 0) {
    return null;
  }
  const absOffset = Math.abs(offset);
  const suffix = absOffset > 1 ? "days" : "day";
  return offset > 0 ? `${absOffset} ${suffix} ahead` : `${absOffset} ${suffix} behind`;
};

/** Joins names as prose: "Maya", "Maya and Kenji", "Maya, Kenji and Sam". */
const formatNameList = (names: ReadonlyArray<string>): string => {
  if (names.length <= 1) {
    return names.join("");
  }
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};

const emptySubscribe = () => () => {};

const useClientValue = <T>(clientValue: () => T, serverValue: T): T =>
  useSyncExternalStore(emptySubscribe, clientValue, () => serverValue);

export {
  EMPTY_GROUPS,
  EMPTY_IDS,
  HOURS_IN_DAY,
  MOBILE_TIME_AXIS_HOURS,
  TIME_AXIS_HOURS,
  formatDayOffset,
  formatNameList,
  getEdgeAlignment,
  useClientValue,
};
