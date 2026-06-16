"use client";

import { Clock } from "lucide-react";
import { useSyncExternalStore } from "react";

import { getUserTimezone, formatTimezoneAbbreviation } from "@/lib/timezones";
import { useSecondTick } from "@/lib/use-tick";

const emptySubscribe = () => () => {};

const useClientValue = <T,>(clientValue: () => T, serverValue: T): T =>
  useSyncExternalStore(emptySubscribe, clientValue, () => serverValue);

const formatTime = (timestamp: number, timezone: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    second: "2-digit",
    timeZone: timezone,
  });
};

const CurrentTimeDisplay = () => {
  // "" on server, real timezone on client — keeps the first paint hydration-safe.
  const viewerTimezone = useClientValue(() => getUserTimezone(), "");

  const tick = useSecondTick();

  if (!viewerTimezone) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-lg border bg-card px-3 py-2 font-medium text-card-foreground shadow-xs">
        <Clock className="size-4 text-muted-foreground" />
        <span className="tabular-nums">--:--:-- --</span>
      </div>
    );
  }

  const currentTime = formatTime(tick, viewerTimezone);
  const timezoneAbbr = formatTimezoneAbbreviation(viewerTimezone);

  return (
    <div className="flex h-9 items-center gap-2 rounded-lg border bg-card px-3 py-2 font-medium text-card-foreground shadow-xs">
      <Clock className="size-4 text-muted-foreground" />
      <span className="text-sm tabular-nums">{currentTime}</span>
      <span className="text-xs text-muted-foreground">{timezoneAbbr}</span>
    </div>
  );
};

export { CurrentTimeDisplay };
