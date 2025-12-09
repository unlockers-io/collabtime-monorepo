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

export {
  COMMON_TIMEZONES,
  getTimezoneOffset,
  formatTimezoneLabel,
  getUserTimezone,
  convertHourToTimezone,
  isCurrentlyWorking,
};
