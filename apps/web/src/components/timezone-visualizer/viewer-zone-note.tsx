"use client";

import { formatTimezoneCity, formatUtcOffset, getViewerTimezone } from "@/lib/timezones";

import { useClientValue } from "./helpers";

const ViewerZoneNote = () => {
  const viewerTimezone = useClientValue(getViewerTimezone, "");

  if (viewerTimezone === "") {
    return <>Shown in your timezone</>;
  }

  return (
    <>
      Shown in your timezone, {formatTimezoneCity(viewerTimezone)} (
      {formatUtcOffset(viewerTimezone)})
    </>
  );
};

export { ViewerZoneNote };
