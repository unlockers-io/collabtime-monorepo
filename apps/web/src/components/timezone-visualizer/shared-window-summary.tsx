"use client";

import { formatDuration, formatMinuteRange, formatUtcOffset } from "@/lib/timezones";

import { formatNameList } from "./helpers";
import { SLOT_MINUTES } from "./timezone-data";
import type { MemberRow, SharedWindowReading, SlotRun, WindowTiming } from "./types";

const formatRun = ({ lengthSlots, startSlot }: SlotRun): string =>
  formatMinuteRange(startSlot * SLOT_MINUTES, (startSlot + lengthSlots) * SLOT_MINUTES);

const formatTiming = (timing: WindowTiming): string => {
  if (timing.kind === "now") {
    return `Now · ${formatDuration(timing.minutesLeft)} left`;
  }
  const inTime = `Starts in ${formatDuration(timing.minutesUntil)}`;
  return timing.isTomorrow ? `${inTime}, tomorrow` : inTime;
};

type Answer = {
  detail: string | null;
  headline: string;
  range: string | null;
  timing: WindowTiming | null;
};

const readAnswer = (reading: SharedWindowReading, rows: ReadonlyArray<MemberRow>): Answer => {
  const total = rows.length;
  const empty = { detail: null, range: null, timing: null };

  if (total < 2) {
    return { ...empty, headline: "Add a teammate to see where your working hours overlap." };
  }
  if (reading.countedCount < 2) {
    return { ...empty, headline: "Count at least two people to find a shared window." };
  }
  if (reading.primary === null) {
    return {
      ...empty,
      detail: "Leave someone out to find a window for the rest.",
      headline: `No working hours overlap among the ${reading.countedCount} people counted.`,
    };
  }

  const { run, timing } = reading.primary;
  const available = new Set(run.availableMemberIds);
  const off = rows.flatMap((row) =>
    row.isCounted && !available.has(row.member.id) ? [row.member.name] : [],
  );

  let detail: string;
  if (off.length === 0) {
    detail =
      reading.countedCount === total
        ? "Everyone is working then."
        : `All ${reading.countedCount} people counted are working then.`;
  } else {
    detail = `${available.size} of ${reading.countedCount} people are working then. ${formatNameList(off)} ${off.length === 1 ? "is" : "are"} off.`;
  }

  return { detail, headline: "Best time to meet:", range: formatRun(run), timing };
};

type SharedWindowSummaryProps = {
  hasCollapsedGroups: boolean;
  hasExplicitExclusions: boolean;
  onCountEveryone: () => void;
  reading: SharedWindowReading;
  rows: ReadonlyArray<MemberRow>;
  viewerTimezone: string;
};

const SharedWindowSummary = ({
  hasCollapsedGroups,
  hasExplicitExclusions,
  onCountEveryone,
  reading,
  rows,
  viewerTimezone,
}: SharedWindowSummaryProps) => {
  const answer = readAnswer(reading, rows);
  const zone = formatUtcOffset(viewerTimezone);
  const primaryRun = reading.primary?.run;
  const otherWindows = reading.windows.flatMap((window) =>
    window === primaryRun ? [] : [formatRun(window)],
  );
  const coverage = reading.groupCoverage === null ? null : formatRun(reading.groupCoverage.run);
  const isCountingSome = rows.length >= 2 && reading.countedCount < rows.length;

  const notes: Array<string> = [];
  if (otherWindows.length > 0) {
    notes.push(`Also ${formatNameList(otherWindows)}.`);
  }
  if (coverage !== null) {
    notes.push(`Every group has someone working ${coverage}.`);
  }
  if (isCountingSome) {
    notes.push(
      `Counting ${reading.countedCount} of ${rows.length} people${hasCollapsedGroups ? "; collapsed groups are left out" : ""}.`,
    );
  }

  const spoken = [
    answer.range === null ? answer.headline : `${answer.headline} ${answer.range}, your time.`,
    answer.detail,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section aria-label="Best time to meet" className="flex flex-col gap-2">
      <span aria-live="polite" className="sr-only">
        {spoken}
      </span>
      <div
        aria-hidden
        className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
      >
        <p className="font-display text-xl font-semibold text-balance text-foreground sm:text-2xl">
          {answer.headline}
          {answer.range !== null && (
            <>
              {" "}
              <span className="font-mono tracking-normal whitespace-nowrap tabular-nums">
                {answer.range}
              </span>{" "}
              <span className="text-base font-medium whitespace-nowrap text-muted-foreground sm:text-lg">
                your time, {zone}
              </span>
            </>
          )}
        </p>
        {answer.timing !== null && (
          <p
            className={
              answer.timing.kind === "now"
                ? "shrink-0 font-mono text-sm text-foreground tabular-nums"
                : "shrink-0 font-mono text-sm text-muted-foreground tabular-nums"
            }
          >
            {formatTiming(answer.timing)}
          </p>
        )}
      </div>
      {answer.detail !== null && (
        <p aria-hidden className="text-sm text-pretty text-muted-foreground">
          {answer.detail}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {notes.length > 0 && <p>{notes.join(" ")}</p>}
        {isCountingSome && hasExplicitExclusions && (
          <button
            className="rounded-sm font-medium text-foreground underline underline-offset-4 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={onCountEveryone}
            type="button"
          >
            Count everyone
          </button>
        )}
        {rows.length >= 2 && <p>Select a name to count or leave someone out.</p>}
      </div>
    </section>
  );
};

export { SharedWindowSummary };
