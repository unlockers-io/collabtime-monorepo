"use client";

import { useNow } from "./use-tick";
import { useViewerTimezone } from "./use-viewer-timezone";

type ViewerClock = {
  isKnown: boolean;
  now: Date;
  viewerTimezone: string;
};

const SAMPLE_CLOCK: ViewerClock = {
  isKnown: false,
  now: new Date("2026-01-05T14:00:00Z"),
  viewerTimezone: "UTC",
};

/** The viewer's timezone and time, or a fixed sample to draw skeletons from until the client knows them. */
const useViewerClock = (): ViewerClock => {
  const viewerTimezone = useViewerTimezone();
  const now = useNow();

  if (viewerTimezone === null || now === null) {
    return SAMPLE_CLOCK;
  }

  return { isKnown: true, now, viewerTimezone };
};

export { useViewerClock };
