"use client";

import { Clock } from "lucide-react";

import { useClientValue } from "@/components/timezone-visualizer/helpers";
import {
  formatMinuteOfDay,
  formatTimezoneCity,
  formatUtcOffset,
  getMinuteOfDay,
  getViewerTimezone,
} from "@/lib/timezones";
import { useSecondTick } from "@/lib/use-tick";

const CLOCK_CLASS =
  "flex h-9 items-center gap-2 rounded-lg border bg-card px-3 py-2 font-medium text-card-foreground shadow-xs";

const CurrentTimeDisplay = () => {
  const viewerTimezone = useClientValue(getViewerTimezone, "");
  const tick = useSecondTick();

  if (!viewerTimezone || tick === 0) {
    return (
      <div className={CLOCK_CLASS}>
        <Clock className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-mono text-sm tabular-nums">--:--</span>
      </div>
    );
  }

  const time = formatMinuteOfDay(getMinuteOfDay(viewerTimezone, new Date(tick)));
  const offset = formatUtcOffset(viewerTimezone);

  return (
    <div className={CLOCK_CLASS}>
      <Clock className="size-4 shrink-0 text-muted-foreground" />
      <span className="sr-only">Your time in {formatTimezoneCity(viewerTimezone)}:</span>
      <time className="font-mono text-sm tabular-nums">{time}</time>
      <span className="font-mono text-xs text-muted-foreground">{offset}</span>
    </div>
  );
};

export { CurrentTimeDisplay };
