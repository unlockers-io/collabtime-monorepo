import { useSyncExternalStore } from "react";

import type { TeamGroup } from "@/types";

import type { OverlapData, Selection } from "./types";

const HOURS_IN_DAY = 24;
const TIME_AXIS_HOURS = [0, 6, 12, 18, 24];
const EMPTY_GROUPS: Array<TeamGroup> = [];
const EMPTY_COLLAPSED_IDS: Array<string> = [];
const HOVER_HIDE_DELAY_MS = 800;
const EMPTY_HOURS = Array.from<boolean>({ length: HOURS_IN_DAY }).fill(false);
const EMPTY_COUNTS = Array.from<number>({ length: HOURS_IN_DAY }).fill(0);

const EMPTY_OVERLAP_DATA: OverlapData = {
  crossTeamOverlapHours: EMPTY_HOURS,
  overlapCounts: EMPTY_COUNTS,
  overlapHours: EMPTY_HOURS,
  partialOverlapHours: EMPTY_HOURS,
};

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

const getOverlapColorClass = (
  isFullOverlap: boolean,
  isCrossTeamOverlap: boolean,
  isPartialOverlap: boolean,
): string => {
  if (isFullOverlap) {
    return "bg-success";
  }
  if (isCrossTeamOverlap) {
    return "bg-info";
  }
  if (isPartialOverlap) {
    return "bg-warning";
  }
  return "bg-muted";
};

const getOverlapLabel = (
  isFullOverlap: boolean,
  isCrossTeamOverlap: boolean,
  totalPeopleSelected: number,
  hourCount: number,
): string => {
  if (isFullOverlap) {
    return `All ${totalPeopleSelected} available`;
  }
  if (isCrossTeamOverlap) {
    return "Each team represented";
  }
  return `${hourCount} of ${totalPeopleSelected} available`;
};

const getCurrentTimePosition = (timezone: string): number => {
  const now = new Date();
  const timeString = now.toLocaleString("en-US", {
    hour: "numeric",
    hour12: false,
    minute: "numeric",
    timeZone: timezone,
  });
  const [hours, minutes] = timeString.split(":").map(Number);
  return ((hours + minutes / 60) / HOURS_IN_DAY) * 100;
};

const serializeSelection = (sel: Selection): string => `${sel.type}:${sel.id}`;

const deserializeSelection = (str: string): Selection | null => {
  const [type, id] = str.split(":");
  if ((type === "member" || type === "group") && id) {
    return { id, type };
  }
  return null;
};

const formatDayOffset = (offset: number): string | null => {
  if (offset === 0) {
    return null;
  }
  const absOffset = Math.abs(offset);
  const suffix = absOffset > 1 ? "days" : "day";
  return offset > 0 ? `${absOffset} ${suffix} ahead` : `${absOffset} ${suffix} behind`;
};

const getRoundedCornerClass = (hour: number): string => {
  if (hour === 0) {
    return "rounded-l";
  }
  if (hour === HOURS_IN_DAY - 1) {
    return "rounded-r";
  }
  return "";
};

const emptySubscribe = () => () => {};

const useClientValue = <T>(clientValue: () => T, serverValue: T): T =>
  useSyncExternalStore(emptySubscribe, clientValue, () => serverValue);

export {
  EMPTY_COLLAPSED_IDS,
  EMPTY_GROUPS,
  EMPTY_HOURS,
  EMPTY_OVERLAP_DATA,
  HOURS_IN_DAY,
  HOVER_HIDE_DELAY_MS,
  TIME_AXIS_HOURS,
  deserializeSelection,
  formatDayOffset,
  getCurrentTimePosition,
  getEdgeAlignment,
  getOverlapColorClass,
  getOverlapLabel,
  getRoundedCornerClass,
  serializeSelection,
  useClientValue,
};
