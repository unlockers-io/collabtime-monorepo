"use client";

import { Clock } from "lucide-react";
import { useSyncExternalStore } from "react";

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

const CurrentTimeDisplay = () => {
  // useClientValue returns "" on server, actual timezone on client - handles hydration
  const viewerTimezone = useClientValue(() => getUserTimezone(), "");

  // Tick updates every second, triggering re-render for real-time display
  const tick = useSecondTick();

  // Show placeholder during SSR (viewerTimezone is empty string on server)
  if (!viewerTimezone) {
    return (
      <div className="h-9 gap-2 px-3 py-2 font-medium shadow-xs flex items-center rounded-lg border border-border bg-card text-card-foreground">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="tabular-nums">--:--:-- --</span>
      </div>
    );
  }

  // Format time using tick timestamp directly
  const currentTime = formatTime(tick, viewerTimezone);
  const timezoneAbbr = formatTimezoneAbbreviation(viewerTimezone);

  return (
    <div className="h-9 gap-2 px-3 py-2 font-medium shadow-xs flex items-center rounded-lg border border-border bg-card text-card-foreground">
      <Clock className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm tabular-nums">{currentTime}</span>
      <span className="text-xs text-muted-foreground">{timezoneAbbr}</span>
    </div>
  );
};

export { CurrentTimeDisplay };
