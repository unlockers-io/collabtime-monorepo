const COMMON_TIMEZONES = [
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Atlantic/Azores",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Athens",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

const getTimezoneOffset = (timezone: string): number => {
  const now = new Date();
  const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzDate = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
};

const getCurrentTimeInTimezone = (timezone: string): string => {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    timeZone: timezone,
  });
};

const formatTimezoneLabel = (timezone: string, includeCurrentTime = false): string => {
  const offset = getTimezoneOffset(timezone);
  const sign = offset >= 0 ? "+" : "";
  const hours = Math.floor(Math.abs(offset));
  const minutes = Math.round((Math.abs(offset) % 1) * 60);
  const offsetStr =
    minutes > 0
      ? `${sign}${offset < 0 ? "-" : ""}${hours}:${minutes.toString().padStart(2, "0")}`
      : `${sign}${offset}`;

  const cityName = timezone.split("/").pop()?.replaceAll("_", " ") ?? timezone;
  const base = `${cityName} (UTC${offsetStr})`;

  if (includeCurrentTime) {
    const currentTime = getCurrentTimeInTimezone(timezone);
    return `${base} - ${currentTime}`;
  }

  return base;
};

const getUserTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

const convertHourToTimezone = (hour: number, fromTimezone: string, toTimezone: string): number => {
  const fromOffset = getTimezoneOffset(fromTimezone);
  const toOffset = getTimezoneOffset(toTimezone);
  const diff = toOffset - fromOffset;
  let converted = Math.round(hour + diff);

  if (converted < 0) {
    converted += 24;
  } else if (converted >= 24) {
    converted -= 24;
  }

  return converted;
};

const isCurrentlyWorking = (
  timezone: string,
  workingHoursStart: number,
  workingHoursEnd: number,
): boolean => {
  const now = new Date();
  const currentHour = Math.trunc(
    Number(
      now.toLocaleString("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: timezone,
      }),
    ),
  );

  if (workingHoursStart <= workingHoursEnd) {
    return currentHour >= workingHoursStart && currentHour < workingHoursEnd;
  }
  return currentHour >= workingHoursStart || currentHour < workingHoursEnd;
};

const getDayOffset = (memberTimezone: string, viewerTimezone: string): number => {
  const now = new Date();

  const viewerDate = now.toLocaleDateString("en-CA", { timeZone: viewerTimezone });
  const memberDate = now.toLocaleDateString("en-CA", { timeZone: memberTimezone });

  const [viewerYear, viewerMonth, viewerDay] = viewerDate.split("-").map(Number);
  const [memberYear, memberMonth, memberDay] = memberDate.split("-").map(Number);

  const viewerDateObj = new Date(viewerYear, viewerMonth - 1, viewerDay);
  const memberDateObj = new Date(memberYear, memberMonth - 1, memberDay);

  const diffTime = memberDateObj.getTime() - viewerDateObj.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};

const getMinutesUntilAvailable = (
  timezone: string,
  workingHoursStart: number,
  workingHoursEnd: number,
): number => {
  if (isCurrentlyWorking(timezone, workingHoursStart, workingHoursEnd)) {
    return 0;
  }

  const now = new Date();
  const currentHour = Math.trunc(
    Number(
      now.toLocaleString("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: timezone,
      }),
    ),
  );
  const currentMinute = Math.trunc(
    Number(
      now.toLocaleString("en-US", {
        minute: "numeric",
        timeZone: timezone,
      }),
    ),
  );

  const currentMinutesFromMidnight = currentHour * 60 + currentMinute;
  const workStartMinutes = workingHoursStart * 60;

  let minutesUntilAvailable: number;

  if (currentMinutesFromMidnight < workStartMinutes) {
    minutesUntilAvailable = workStartMinutes - currentMinutesFromMidnight;
  } else {
    const minutesUntilMidnight = 24 * 60 - currentMinutesFromMidnight;
    minutesUntilAvailable = minutesUntilMidnight + workStartMinutes;
  }

  return minutesUntilAvailable;
};

const formatTimeUntilAvailable = (minutes: number): string => {
  if (minutes === 0) {
    return "Available now";
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `in ${mins}m`;
  }
  if (mins === 0) {
    return `in ${hours}h`;
  }
  return `in ${hours}h ${mins}m`;
};

const formatTimezoneAbbreviation = (timezone: string): string => {
  const now = new Date();
  const parts = now
    .toLocaleTimeString("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    })
    .split(" ");
  return parts.at(-1) ?? timezone.split("/").pop() ?? timezone;
};

const fuzzyMatchTimezone = (input: string): (typeof COMMON_TIMEZONES)[number] | null => {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (COMMON_TIMEZONES.includes(trimmed as (typeof COMMON_TIMEZONES)[number])) {
    return trimmed as (typeof COMMON_TIMEZONES)[number];
  }

  let inputOffset: number;
  try {
    // Intl.DateTimeFormat throws RangeError for invalid timeZone values
    Intl.DateTimeFormat("en", { timeZone: trimmed });
    inputOffset = getTimezoneOffset(trimmed);
  } catch {
    return null;
  }

  let best: (typeof COMMON_TIMEZONES)[number] | null = null;
  let bestDiff = Infinity;

  for (const tz of COMMON_TIMEZONES) {
    const diff = Math.abs(getTimezoneOffset(tz) - inputOffset);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = tz;
    }
  }

  return best;
};

export {
  COMMON_TIMEZONES,
  formatTimezoneLabel,
  fuzzyMatchTimezone,
  getUserTimezone,
  convertHourToTimezone,
  isCurrentlyWorking,
  getDayOffset,
  getMinutesUntilAvailable,
  formatTimeUntilAvailable,
  formatTimezoneAbbreviation,
};
