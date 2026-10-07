"use client";

import { formatTimezoneCity, formatUtcOffset } from "@/lib/timezones";
import { useHalfMinuteTick } from "@/lib/use-tick";
import { useViewerTimezone } from "@/lib/use-viewer-timezone";

const ViewerZoneNote = () => {
  const viewerTimezone = useViewerTimezone();
  const tick = useHalfMinuteTick();

  if (viewerTimezone === "" || tick === 0) {
    return <>Shown in your timezone</>;
  }

  return (
    <>
      Shown in your timezone, {formatTimezoneCity(viewerTimezone)} (
      {formatUtcOffset(viewerTimezone, new Date(tick))})
    </>
  );
};

export { ViewerZoneNote };
