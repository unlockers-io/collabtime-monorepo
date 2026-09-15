"use client";

import { cn } from "@repo/ui/lib/utils";

import { formatHour } from "@/lib/utils";

import { HOURS_IN_DAY, TIME_AXIS_HOURS, getEdgeAlignment } from "./helpers";

const TimeAxis = () => (
  <div className="flex gap-2 sm:gap-3">
    <div className="w-28 shrink-0 sm:w-40" />
    <div className="flex flex-1 justify-between">
      {TIME_AXIS_HOURS.map((hour, index, arr) => {
        const isFirst = index === 0;
        const isLast = index === arr.length - 1;

        return (
          <div
            className={cn(
              "time-label-alignment",
              cn("flex flex-col", (hour === 6 || hour === 18) && "max-sm:hidden"),
            )}
            key={hour}
            style={{ "--time-axis-align-items": getEdgeAlignment(isFirst, isLast) }}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                {formatHour(hour % HOURS_IN_DAY)}
              </span>
              <div className="h-1.5 w-px bg-border" />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export { TimeAxis };
