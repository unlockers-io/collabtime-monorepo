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
 * Format the current time for a given timezone.
 * Uses tick timestamp to ensure Date calculation happens fresh on each tick.
 */
const formatCurrentTime = (timezone: string, tick: number): string => {
  // Use tick to create Date, ensuring fresh calculation each time
  // (tick is a timestamp, but we create new Date() for locale formatting accuracy)
  void tick;
  const now = new Date();
  return now.toLocaleTimeString("en-US", {
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

  // Format time using tick as cache-buster (tick changes trigger new Date() call)
  const currentTime = formatCurrentTime(viewerTimezone, tick);
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
