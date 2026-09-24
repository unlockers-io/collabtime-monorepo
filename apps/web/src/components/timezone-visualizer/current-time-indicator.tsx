"use client";

import { MINUTES_IN_DAY } from "@/lib/timezones";

type CurrentTimeIndicatorProps = {
  nowMinute: number | null;
};

// The 1px background ring keeps the line readable where it crosses the
// best-window cells, which share its foreground fill.
const LINE_CLASS =
  "pointer-events-none absolute top-0 bottom-0 current-time-position z-20 w-px bg-foreground ring-1 ring-background";

const CurrentTimeIndicator = ({ nowMinute }: CurrentTimeIndicatorProps) => {
  if (nowMinute === null) {
    return null;
  }

  const fraction = nowMinute / MINUTES_IN_DAY;

  return (
    <>
      <div
        aria-hidden
        className={`${LINE_CLASS} sm:hidden`}
        style={{
          "--current-time-indicator-left": `calc(7.5rem + (100% - 7.5rem) * ${fraction})`,
        }}
      />
      <div
        aria-hidden
        className={`${LINE_CLASS} hidden sm:block`}
        style={{
          "--current-time-indicator-left": `calc(10.75rem + (100% - 10.75rem) * ${fraction})`,
        }}
      />
    </>
  );
};

export { CurrentTimeIndicator };
