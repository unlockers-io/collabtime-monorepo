"use client";

import { useSyncExternalStore } from "react";
import { Clock } from "lucide-react";

import { getUserTimezone, formatTimezoneAbbreviation } from "@/lib/timezones";
import { useSecondTick } from "@/lib/use-tick";

// ============================================================================
// Hooks
// ============================================================================

const emptySubscribe = () => () => {};

const useClientValue = <T,>(clientValue: () => T, serverValue: T): T =>
  useSyncExternalStore(emptySubscribe, clientValue, () => serverValue);

// ============================================================================
// Utilities
// ============================================================================

/**
 * Format a timestamp for a given timezone.
 */
const formatTime = (timestamp: number, timezone: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

// ============================================================================
// Component
// ============================================================================

const CurrentTimeDisplay = () => {
  // useClientValue returns "" on server, actual timezone on client - handles hydration
  const viewerTimezone = useClientValue(() => getUserTimezone(), "");

  // Tick updates every second, triggering re-render for real-time display
  const tick = useSecondTick();

  // Show placeholder during SSR (viewerTimezone is empty string on server)
  if (!viewerTimezone) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        <Clock className="h-4 w-4 text-neutral-500" />
        <span className="tabular-nums">--:--:-- --</span>
      </div>
    );
  }

  // Format time using tick timestamp directly
  const currentTime = formatTime(tick, viewerTimezone);
  const timezoneAbbr = formatTimezoneAbbreviation(viewerTimezone);

  return (
    <div className="flex h-10 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
      <Clock className="h-4 w-4 text-neutral-500" />
      <span className="tabular-nums">{currentTime}</span>
      <span className="text-xs text-neutral-500 dark:text-neutral-400">{timezoneAbbr}</span>
    </div>
  );
};

export { CurrentTimeDisplay };
