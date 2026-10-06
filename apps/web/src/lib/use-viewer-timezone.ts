"use client";

import { useSyncExternalStore } from "react";

import { getViewerTimezone } from "@/lib/timezones";

const subscribe = () => () => {};
const getServerTimezone = () => "";

/** The browser's timezone, or an empty string until rendered on the client. */
const useViewerTimezone = (): string =>
  useSyncExternalStore(subscribe, getViewerTimezone, getServerTimezone);

export { useViewerTimezone };
