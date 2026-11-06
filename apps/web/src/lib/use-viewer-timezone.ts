"use client";

import { useSyncExternalStore } from "react";

import { getViewerTimezone } from "@/lib/timezones";

const subscribe = () => () => {};
const getServerTimezone = (): null => null;

/** The browser's timezone, or null before hydration. */
const useViewerTimezone = (): string | null =>
  useSyncExternalStore(subscribe, getViewerTimezone, getServerTimezone);

export { useViewerTimezone };
