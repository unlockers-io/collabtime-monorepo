// Common timezones for the dropdown
const COMMON_TIMEZONES = [
  "Pacific/Honolulu", // UTC-10
  "America/Anchorage", // UTC-9
  "America/Los_Angeles", // UTC-8
  "America/Denver", // UTC-7
  "America/Chicago", // UTC-6
  "America/New_York", // UTC-5
  "America/Sao_Paulo", // UTC-3
  "Atlantic/Azores", // UTC-1
  "Europe/London", // UTC+0
  "Europe/Paris", // UTC+1
  "Europe/Berlin", // UTC+1
  "Europe/Athens", // UTC+2
  "Europe/Moscow", // UTC+3
  "Asia/Dubai", // UTC+4
  "Asia/Kolkata", // UTC+5:30
  "Asia/Dhaka", // UTC+6
  "Asia/Bangkok", // UTC+7
  "Asia/Shanghai", // UTC+8
  "Asia/Tokyo", // UTC+9
  "Australia/Sydney", // UTC+10/11
  "Pacific/Auckland", // UTC+12/13
] as const;

const getTimezoneOffset = (timezone: string): number => {
  const now = new Date();
  const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzDate = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
};

const getCurrentTimeInTimezone = (timezone: string): string => {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const formatTimezoneLabel = (
  timezone: string,
  includeCurrentTime = false
): string => {
  const offset = getTimezoneOffset(timezone);
  const sign = offset >= 0 ? "+" : "";
  const hours = Math.floor(Math.abs(offset));
  const minutes = Math.round((Math.abs(offset) % 1) * 60);
  const offsetStr =
    minutes > 0
      ? `${sign}${offset < 0 ? "-" : ""}${hours}:${minutes.toString().padStart(2, "0")}`
      : `${sign}${offset}`;

  const cityName = timezone.split("/").pop()?.replace(/_/g, " ") ?? timezone;
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

const convertHourToTimezone = (
  hour: number,
  fromTimezone: string,
  toTimezone: string
): number => {
  const fromOffset = getTimezoneOffset(fromTimezone);
  const toOffset = getTimezoneOffset(toTimezone);
  const diff = toOffset - fromOffset;
  let converted = Math.round(hour + diff);

  // Wrap around 24-hour clock
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
  workingHoursEnd: number
): boolean => {
  const now = new Date();
  const currentHour = parseInt(
    now.toLocaleString("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }),
    10
  );

  if (workingHoursStart <= workingHoursEnd) {
    return currentHour >= workingHoursStart && currentHour < workingHoursEnd;
  }
  // Working hours cross midnight
  return currentHour >= workingHoursStart || currentHour < workingHoursEnd;
};

const getDayOffset = (
  memberTimezone: string,
  viewerTimezone: string
): number => {
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
  workingHoursEnd: number
): number => {
  // If currently working, return 0
  if (isCurrentlyWorking(timezone, workingHoursStart, workingHoursEnd)) {
    return 0;
  }

  const now = new Date();
  const currentHour = parseInt(
    now.toLocaleString("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }),
    10
  );
  const currentMinute = parseInt(
    now.toLocaleString("en-US", {
      timeZone: timezone,
      minute: "numeric",
    }),
    10
  );

  const currentMinutesFromMidnight = currentHour * 60 + currentMinute;
  const workStartMinutes = workingHoursStart * 60;

  let minutesUntilAvailable: number;

  if (currentMinutesFromMidnight < workStartMinutes) {
    // Work hasn't started yet today
    minutesUntilAvailable = workStartMinutes - currentMinutesFromMidnight;
  } else {
    // Work already ended today, calculate time until tomorrow's start
    const minutesUntilMidnight = 24 * 60 - currentMinutesFromMidnight;
    minutesUntilAvailable = minutesUntilMidnight + workStartMinutes;
  }

  return minutesUntilAvailable;
};

const formatTimeUntilAvailable = (minutes: number): string => {
  if (minutes === 0) return "Available now";

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
  // Get the timezone abbreviation (e.g., "PST", "EST", "GMT")
  const parts = now
    .toLocaleTimeString("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    })
    .split(" ");
  // The abbreviation is typically the last part
  return parts[parts.length - 1] ?? timezone.split("/").pop() ?? timezone;
};

const getWorkingHoursInViewerTimezone = (
  memberTimezone: string,
  workingHoursStart: number,
  workingHoursEnd: number,
  viewerTimezone: string
): number[] => {
  const startInViewer = convertHourToTimezone(
    workingHoursStart,
    memberTimezone,
    viewerTimezone
  );
  const endInViewer = convertHourToTimezone(
    workingHoursEnd,
    memberTimezone,
    viewerTimezone
  );

  const hours: number[] = [];

  if (startInViewer < endInViewer) {
    for (let h = startInViewer; h < endInViewer; h++) {
      hours.push(h);
    }
  } else {
    // Overnight case: hours wrap around midnight
    for (let h = startInViewer; h < 24; h++) {
      hours.push(h);
    }
    for (let h = 0; h < endInViewer; h++) {
      hours.push(h);
    }
  }

  return hours;
};

const getFlexHoursEarly = (
  memberTimezone: string,
  workingHoursStart: number,
  viewerTimezone: string,
  flexRange: number
): number[] => {
  const normalStart = convertHourToTimezone(
    workingHoursStart,
    memberTimezone,
    viewerTimezone
  );

  const flexHours: number[] = [];
  for (let i = 1; i <= flexRange; i++) {
    const flexHour = (normalStart - i + 24) % 24;
    flexHours.push(flexHour);
  }
  return flexHours;
};

const getFlexHoursLate = (
  memberTimezone: string,
  workingHoursEnd: number,
  viewerTimezone: string,
  flexRange: number
): number[] => {
  const normalEnd = convertHourToTimezone(
    workingHoursEnd,
    memberTimezone,
    viewerTimezone
  );

  const flexHours: number[] = [];
  for (let i = 0; i < flexRange; i++) {
    const flexHour = (normalEnd + i) % 24;
    flexHours.push(flexHour);
  }
  return flexHours;
};

const isHourInWorkingRange = (
  hour: number,
  memberTimezone: string,
  workingHoursStart: number,
  workingHoursEnd: number,
  viewerTimezone: string
): boolean => {
  const workingHours = getWorkingHoursInViewerTimezone(
    memberTimezone,
    workingHoursStart,
    workingHoursEnd,
    viewerTimezone
  );
  return workingHours.includes(hour);
};

const isHourInFlexRange = (
  hour: number,
  memberTimezone: string,
  workingHoursStart: number,
  workingHoursEnd: number,
  viewerTimezone: string,
  flexRange: number
): { canFlex: boolean; direction: "early" | "late" | null; hoursNeeded: number } => {
  const earlyFlex = getFlexHoursEarly(
    memberTimezone,
    workingHoursStart,
    viewerTimezone,
    flexRange
  );
  const lateFlex = getFlexHoursLate(
    memberTimezone,
    workingHoursEnd,
    viewerTimezone,
    flexRange
  );

  const earlyIndex = earlyFlex.indexOf(hour);
  if (earlyIndex !== -1) {
    return { canFlex: true, direction: "early", hoursNeeded: earlyIndex + 1 };
  }

  const lateIndex = lateFlex.indexOf(hour);
  if (lateIndex !== -1) {
    return { canFlex: true, direction: "late", hoursNeeded: lateIndex + 1 };
  }

  return { canFlex: false, direction: null, hoursNeeded: 0 };
};

export {
  COMMON_TIMEZONES,
  getTimezoneOffset,
  formatTimezoneLabel,
  getUserTimezone,
  convertHourToTimezone,
  isCurrentlyWorking,
  getDayOffset,
  getMinutesUntilAvailable,
  formatTimeUntilAvailable,
  formatTimezoneAbbreviation,
  getWorkingHoursInViewerTimezone,
  getFlexHoursEarly,
  getFlexHoursLate,
  isHourInWorkingRange,
  isHourInFlexRange,
};
