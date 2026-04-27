"use client";

import { formatHour } from "@/lib/utils";

import { HOURS_IN_DAY, TIME_AXIS_HOURS, getEdgeAlignment } from "./helpers";

const TimeAxis = () => (
  <div className="flex gap-2 sm:gap-3">
    <div className="w-8 shrink-0 sm:w-24" />
    <div className="flex flex-1 justify-between">
      {TIME_AXIS_HOURS.map((hour, index, arr) => {
        const isFirst = index === 0;
        const isLast = index === arr.length - 1;

        return (
          <div
            className="flex flex-col"
            key={hour}
            style={{
              alignItems: getEdgeAlignment(isFirst, isLast),
            }}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] whitespace-nowrap text-muted-foreground tabular-nums sm:text-xs">
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
