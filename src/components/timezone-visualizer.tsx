"use client";

import { motion } from "motion/react";
import { useMemo, useSyncExternalStore } from "react";
import type { TeamMember } from "@/types";
import { convertHourToTimezone, getUserTimezone } from "@/lib/timezones";
import { formatHour } from "@/lib/utils";

type TimezoneVisualizerProps = {
  members: TeamMember[];
};

const getCurrentTimePosition = (timezone: string): number => {
  const now = new Date();
  const timeString = now.toLocaleString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const [hours, minutes] = timeString.split(":").map(Number);
  return ((hours + minutes / 60) / 24) * 100;
};

const emptySubscribe = () => () => {};

const useClientValue = <T,>(clientValue: () => T, serverValue: T): T => {
  return useSyncExternalStore(emptySubscribe, clientValue, () => serverValue);
};

const TimezoneVisualizer = ({ members }: TimezoneVisualizerProps) => {
  const viewerTimezone = useClientValue(() => getUserTimezone(), "");
  const tick = useSyncExternalStore(
    (callback) => {
      // Update every 30 seconds instead of every second
      const interval = setInterval(callback, 30000);
      return () => clearInterval(interval);
    },
    () => Date.now(),
    () => 0
  );

  const nowPosition = useMemo(() => {
    if (!viewerTimezone) return null;
    void tick;
    return getCurrentTimePosition(viewerTimezone);
  }, [viewerTimezone, tick]);

  const memberRows = useMemo(() => {
    if (!viewerTimezone) return [];

    return members.map((member) => {
      const hours = new Array(24).fill(false);
      const startInViewerTz = convertHourToTimezone(
        member.workingHoursStart,
        member.timezone,
        viewerTimezone
      );
      const endInViewerTz = convertHourToTimezone(
        member.workingHoursEnd,
        member.timezone,
        viewerTimezone
      );

      if (startInViewerTz <= endInViewerTz) {
        for (let h = startInViewerTz; h < endInViewerTz; h++) {
          hours[h] = true;
        }
      } else {
        for (let h = startInViewerTz; h < 24; h++) {
          hours[h] = true;
        }
        for (let h = 0; h < endInViewerTz; h++) {
          hours[h] = true;
        }
      }

      return { member, hours };
    });
  }, [members, viewerTimezone]);

  if (members.length === 0 || !viewerTimezone) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-24" />
          <div className="flex flex-1 justify-between font-mono text-xs text-neutral-500 dark:text-neutral-400">
            {[0, 6, 12, 18, 23].map((hour) => (
              <span key={hour}>{formatHour(hour)}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {memberRows.map(({ member, hours }) => (
            <motion.div
              key={member.id}
              layout
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="flex items-center gap-3"
            >
              <div className="w-24 truncate text-sm text-neutral-600 dark:text-neutral-400">
                {member.name}
              </div>
              <div className="relative flex flex-1 gap-px overflow-hidden rounded bg-neutral-100 p-1 dark:bg-neutral-800">
                {nowPosition !== null && (
                  <div
                    className="absolute top-0 bottom-0 z-10 w-0.5 rounded-full bg-neutral-900 dark:bg-neutral-100"
                    style={{ left: `${nowPosition}%` }}
                  />
                )}
                {hours.map((isWorking, hour) => (
                  <div
                    key={hour}
                    className={`h-4 flex-1 ${
                      hour === 0
                        ? "rounded-l-sm"
                        : hour === 23
                          ? "rounded-r-sm"
                          : ""
                    } ${
                      isWorking
                        ? "bg-neutral-400 dark:bg-neutral-500"
                        : "bg-neutral-200 dark:bg-neutral-700"
                    }`}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export { TimezoneVisualizer };
