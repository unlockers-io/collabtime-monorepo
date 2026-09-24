"use client";

import { cn } from "@repo/ui/lib/utils";

import { formatHour } from "@/lib/utils";

import { HOURS_IN_DAY, MOBILE_TIME_AXIS_HOURS, TIME_AXIS_HOURS, getEdgeAlignment } from "./helpers";

const TimeAxis = () => (
  <div aria-hidden className="flex gap-2 sm:gap-3">
    <div className="w-28 shrink-0 sm:w-40" />
    <div className="flex flex-1 justify-between">
      {TIME_AXIS_HOURS.map((hour, index, arr) => (
        <div
          className={cn(
            "flex flex-col time-label-alignment",
            !MOBILE_TIME_AXIS_HOURS.has(hour) && "max-sm:hidden",
          )}
          key={hour}
          style={{
            "--time-axis-align-items": getEdgeAlignment(index === 0, index === arr.length - 1),
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">
              {formatHour(hour % HOURS_IN_DAY)}
            </span>
            <div className="h-1.5 w-px bg-border" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export { TimeAxis };
