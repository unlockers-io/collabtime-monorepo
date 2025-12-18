"use client";

import { memo, useMemo } from "react";
import { Clock, User, AlertCircle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import type { MeetingFinderResult, MeetingSlot, MeetingQuality } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn, formatHour12 } from "@/lib/utils";

const HOURS_IN_DAY = 24;

const formatTimeRange = (startHour: number, endHour: number): string => {
  return `${formatHour12(startHour)} – ${formatHour12(endHour)}`;
};

const qualityConfig: Record<
  MeetingQuality,
  { label: string; className: string; icon: React.ReactNode }
> = {
  excellent: {
    label: "Excellent",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    icon: <Sparkles className="h-3 w-3" />,
  },
  good: {
    label: "Good",
    className:
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
    icon: null,
  },
  fair: {
    label: "Fair",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    icon: null,
  },
  poor: {
    label: "Poor",
    className:
      "bg-neutral-50 text-neutral-600 border-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:border-neutral-700",
    icon: null,
  },
};

type TimeBarProps = {
  startHour: number;
  duration: number;
  quality: MeetingQuality;
};

const TimeBar = memo(({ startHour, duration, quality }: TimeBarProps) => {
  const barColor =
    quality === "excellent"
      ? "bg-emerald-500 dark:bg-emerald-400"
      : quality === "good"
        ? "bg-sky-500 dark:bg-sky-400"
        : quality === "fair"
          ? "bg-amber-500 dark:bg-amber-400"
          : "bg-neutral-400 dark:bg-neutral-500";

  const leftPercent = (startHour / HOURS_IN_DAY) * 100;
  const widthPercent = (duration / HOURS_IN_DAY) * 100;

  return (
    <div className="relative h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800">
      <div
        className={cn("absolute h-full rounded-full", barColor)}
        style={{
          left: `${leftPercent}%`,
          width: `${widthPercent}%`,
        }}
      />
    </div>
  );
});
TimeBar.displayName = "TimeBar";

type MeetingSlotCardProps = {
  slot: MeetingSlot;
  rank: number;
};

const MeetingSlotCard = memo(({ slot, rank }: MeetingSlotCardProps) => {
  const config = qualityConfig[slot.quality];
  const totalParticipants =
    slot.availableMembers.length +
    slot.flexingMembers.length +
    slot.unavailableMembers.length;

  const summaryText = useMemo(() => {
    if (slot.unavailableMembers.length === 0 && slot.flexingMembers.length === 0) {
      return `All ${slot.availableMembers.length} participants available`;
    }
    if (slot.unavailableMembers.length === 0) {
      const flexNames = slot.flexingMembers
        .map((f) => {
          const direction = f.direction === "early" ? "earlier" : "later";
          return `${f.member.name} ${f.hours}h ${direction}`;
        })
        .join(", ");
      return `All available (${flexNames})`;
    }
    const unavailNames = slot.unavailableMembers.map((m) => m.name).join(", ");
    return `${slot.availableMembers.length + slot.flexingMembers.length}/${totalParticipants} available (${unavailNames} unavailable)`;
  }, [slot, totalParticipants]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15, delay: rank * 0.05 }}
      className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            {rank}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {formatTimeRange(slot.startHour, slot.endHour)}
            </span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {slot.duration}h duration
            </span>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn("gap-1 text-xs", config.className)}
        >
          {config.icon}
          {config.label}
        </Badge>
      </div>

      <TimeBar
        startHour={slot.startHour}
        duration={slot.duration}
        quality={slot.quality}
      />

      <p className="text-xs text-neutral-600 dark:text-neutral-400">
        {summaryText}
      </p>

      {slot.flexingMembers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {slot.flexingMembers.map((f) => (
            <Badge
              key={f.member.id}
              variant="outline"
              className="gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
            >
              <Clock className="h-3 w-3" />
              {f.member.name} {f.hours}h {f.direction}
            </Badge>
          ))}
        </div>
      )}
    </motion.div>
  );
});
MeetingSlotCard.displayName = "MeetingSlotCard";

type NoResultsProps = {
  suggestion?: string;
  allowFlexHours: boolean;
  onToggleFlex: () => void;
};

const NoResults = memo(
  ({ suggestion, allowFlexHours, onToggleFlex }: NoResultsProps) => {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-3 py-4 text-center"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <AlertCircle className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            No common times found
          </p>
          {suggestion && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {suggestion}
            </p>
          )}
        </div>
        {!allowFlexHours && (
          <button
            type="button"
            onClick={onToggleFlex}
            className="text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
          >
            Try enabling flex hours →
          </button>
        )}
      </motion.div>
    );
  }
);
NoResults.displayName = "NoResults";

type MeetingResultsProps = {
  results: MeetingFinderResult;
  allowFlexHours: boolean;
  onToggleFlex: () => void;
};

const MeetingResults = memo(
  ({ results, allowFlexHours, onToggleFlex }: MeetingResultsProps) => {
    if (!results.hasResults) {
      return (
        <NoResults
          suggestion={results.suggestion}
          allowFlexHours={allowFlexHours}
          onToggleFlex={onToggleFlex}
        />
      );
    }

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Best Meeting Times
          </span>
        </div>

        <AnimatePresence mode="popLayout">
          {results.slots.map((slot, index) => (
            <MeetingSlotCard key={slot.id} slot={slot} rank={index + 1} />
          ))}
        </AnimatePresence>
      </div>
    );
  }
);
MeetingResults.displayName = "MeetingResults";

export { MeetingResults };
