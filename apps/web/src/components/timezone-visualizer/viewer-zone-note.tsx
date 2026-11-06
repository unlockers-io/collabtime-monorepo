"use client";

import { formatTimezoneCity, formatUtcOffset } from "@/lib/timezones";
import { useNow } from "@/lib/use-tick";
import { useViewerTimezone } from "@/lib/use-viewer-timezone";

const ViewerZoneNote = () => {
  const viewerTimezone = useViewerTimezone();
  const now = useNow();

  if (viewerTimezone === null || now === null) {
    return <>Shown in your timezone</>;
  }

  return (
    <>
      Shown in your timezone, {formatTimezoneCity(viewerTimezone)} (
      {formatUtcOffset(viewerTimezone, now)})
    </>
  );
};

export { ViewerZoneNote };
