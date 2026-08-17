import { useSyncExternalStore } from "react";

import type { TeamGroup } from "@/types";

import type { HourOverlap, OverlapData, Selection } from "./types";

const HOURS_IN_DAY = 24;
const TIME_AXIS_HOURS = [0, 6, 12, 18, 24];
const EMPTY_GROUPS: Array<TeamGroup> = [];
const EMPTY_COLLAPSED_IDS: Array<string> = [];
const HOVER_HIDE_DELAY_MS = 800;
const EMPTY_HOURS = Array.from<boolean>({ length: HOURS_IN_DAY }).fill(false);

// Frozen because this single instance is returned by reference from both
// early-exit paths in getTimezoneData.
const EMPTY_OVERLAP_DATA: OverlapData = Object.freeze({
  hours: Object.freeze(
    Array.from<unknown, HourOverlap>({ length: HOURS_IN_DAY }, () =>
      Object.freeze({ availableCount: 0, coverage: "none", isEveryTeamRepresented: false }),
    ),
  ),
});

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

const hasAnyOverlap = (hour: HourOverlap): boolean =>
  hour.coverage !== "none" || hour.isEveryTeamRepresented;

const getOverlapColorClass = (hour: HourOverlap): string => {
  if (hour.coverage === "full") {
    return "bg-success";
  }
  if (hour.isEveryTeamRepresented) {
    return "bg-info";
  }
  if (hour.coverage === "partial") {
    return "bg-warning";
  }
  return "bg-muted";
};

const getOverlapLabel = (hour: HourOverlap, totalPeopleSelected: number): string => {
  if (hour.coverage === "full") {
    return `All ${totalPeopleSelected} available`;
  }
  if (hour.isEveryTeamRepresented) {
    return "Each team represented";
  }
  return `${hour.availableCount} of ${totalPeopleSelected} available`;
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
  hasAnyOverlap,
  serializeSelection,
  useClientValue,
};
