const COMMON_TIMEZONES = [
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Vancouver",
  "America/Denver",
  "America/Chicago",
  "America/Mexico_City",
  "America/New_York",
  "America/Toronto",
  "America/Bogota",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Atlantic/Azores",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Warsaw",
  "Africa/Lagos",
  "Europe/Athens",
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Manila",
  "Australia/Perth",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Pacific/Auckland",
] as const;

const DEFAULT_MEMBER_TIMEZONE = "America/New_York";
const DEFAULT_WORKING_HOURS_START = 9;
const DEFAULT_WORKING_HOURS_END = 17;
const COMMON_TIMEZONE_SET: ReadonlySet<string> = new Set(COMMON_TIMEZONES);

type CommonTimezone = (typeof COMMON_TIMEZONES)[number];

const MINUTES_IN_DAY = 24 * 60;

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();
const clockFormatters = new Map<string, Intl.DateTimeFormat>();

const getOffsetFormatter = (timezone: string): Intl.DateTimeFormat => {
  let formatter = offsetFormatters.get(timezone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longOffset",
    });
    offsetFormatters.set(timezone, formatter);
  }
  return formatter;
};

const getClockFormatter = (timezone: string): Intl.DateTimeFormat => {
  let formatter = clockFormatters.get(timezone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      timeZone: timezone,
    });
    clockFormatters.set(timezone, formatter);
  }
  return formatter;
};

const OFFSET_PATTERN = /^GMT(?<sign>[+\-\u2212])(?<hours>\d{1,2})(?::(?<minutes>\d{2}))?$/v;

/** UTC offset in minutes at `at`, e.g. 330 for Asia/Kolkata. */
const getOffsetMinutes = (timezone: string, at: Date = new Date()): number => {
  const name =
    getOffsetFormatter(timezone)
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const groups: Partial<Record<"hours" | "minutes" | "sign", string>> | undefined =
    OFFSET_PATTERN.exec(name)?.groups;
  if (groups === undefined) {
    return 0;
  }
  const minutes = Number(groups.hours) * 60 + Number(groups.minutes ?? 0);
  return groups.sign === "+" ? minutes : -minutes;
};

/** Minutes since local midnight in `timezone`, 0 to 1439. */
const getMinuteOfDay = (timezone: string, at: Date = new Date()): number => {
  const parts = getClockFormatter(timezone).formatToParts(at);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return (hour % 24) * 60 + minute;
};

const wrapMinutes = (minutes: number): number =>
  ((minutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;

const formatMinuteOfDay = (minutes: number): string => {
  const wrapped = wrapMinutes(minutes);
  const hours = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
};

/** A range end of midnight reads as 24:00 so "22:00 – 24:00" never looks inverted. */
const formatMinuteRange = (startMinute: number, endMinute: number): string => {
  const end = wrapMinutes(endMinute) === 0 ? "24:00" : formatMinuteOfDay(endMinute);
  return `${formatMinuteOfDay(startMinute)} – ${end}`;
};

const formatUtcOffset = (timezone: string, at: Date = new Date()): string => {
  const offset = getOffsetMinutes(timezone, at);
  if (offset === 0) {
    return "UTC";
  }
  const sign = offset > 0 ? "+" : "-";
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${minutes.toString().padStart(2, "0")}`;
};

const formatTimezoneCity = (timezone: string): string =>
  timezone.split("/").pop()?.replaceAll("_", " ") ?? timezone;

const formatTimezoneLabel = (timezone: string, includeCurrentTime = false): string => {
  const base = `${formatTimezoneCity(timezone)} (${formatUtcOffset(timezone)})`;
  return includeCurrentTime ? `${base} · ${formatMinuteOfDay(getMinuteOfDay(timezone))}` : base;
};

type WorkingInterval = {
  lengthMinutes: number;
  startMinute: number;
};

/**
 * A member's working hours placed on the viewer's day, to the minute. Hours
 * are stored as whole hours in the member's own zone, so a half-hour offset
 * such as Asia/Kolkata lands on :30 in the viewer's frame.
 */
const getWorkingInterval = (
  member: { timezone: string; workingHoursEnd: number; workingHoursStart: number },
  viewerTimezone: string,
  at: Date = new Date(),
): WorkingInterval => {
  const shift = getOffsetMinutes(viewerTimezone, at) - getOffsetMinutes(member.timezone, at);
  const lengthHours = (member.workingHoursEnd - member.workingHoursStart + 24) % 24;
  return {
    lengthMinutes: lengthHours * 60,
    startMinute: wrapMinutes(member.workingHoursStart * 60 + shift),
  };
};

const isMinuteInInterval = (minute: number, { lengthMinutes, startMinute }: WorkingInterval) =>
  wrapMinutes(minute - startMinute) < lengthMinutes;

const isCurrentlyWorking = (
  timezone: string,
  workingHoursStart: number,
  workingHoursEnd: number,
  at: Date = new Date(),
): boolean =>
  isMinuteInInterval(getMinuteOfDay(timezone, at), {
    lengthMinutes: ((workingHoursEnd - workingHoursStart + 24) % 24) * 60,
    startMinute: workingHoursStart * 60,
  });

const getMinutesUntilAvailable = (
  timezone: string,
  workingHoursStart: number,
  workingHoursEnd: number,
  at: Date = new Date(),
): number => {
  if (isCurrentlyWorking(timezone, workingHoursStart, workingHoursEnd, at)) {
    return 0;
  }
  return wrapMinutes(workingHoursStart * 60 - getMinuteOfDay(timezone, at));
};

const getMinutesUntilDayEnds = (
  timezone: string,
  workingHoursEnd: number,
  at: Date = new Date(),
): number => wrapMinutes(workingHoursEnd * 60 - getMinuteOfDay(timezone, at));

const getDayOffset = (memberTimezone: string, viewerTimezone: string): number => {
  const now = new Date();

  const viewerDate = now.toLocaleDateString("en-CA", { timeZone: viewerTimezone });
  const memberDate = now.toLocaleDateString("en-CA", { timeZone: memberTimezone });

  const diffTime = new Date(memberDate).getTime() - new Date(viewerDate).getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  }
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
};

const formatTimeUntilAvailable = (minutes: number): string =>
  minutes === 0 ? "Available now" : `in ${formatDuration(minutes)}`;

const isCommonTimezone = (value: string): value is CommonTimezone => COMMON_TIMEZONE_SET.has(value);

const isValidTimezone = (value: string): boolean => {
  try {
    Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const fuzzyMatchTimezone = (input: string): CommonTimezone | null => {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (isCommonTimezone(trimmed)) {
    return trimmed;
  }

  if (!isValidTimezone(trimmed)) {
    return null;
  }
  const inputOffset = getOffsetMinutes(trimmed);

  let best: CommonTimezone | null = null;
  let bestDiff = Infinity;

  for (const tz of COMMON_TIMEZONES) {
    const diff = Math.abs(getOffsetMinutes(tz) - inputOffset);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = tz;
    }
  }

  return best;
};

/** The supported zone closest to the browser's, for defaults that must be stored. */
const getUserTimezone = (): CommonTimezone => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    COMMON_TIMEZONES.find((commonTimezone) => commonTimezone === timezone) ??
    fuzzyMatchTimezone(timezone) ??
    DEFAULT_MEMBER_TIMEZONE
  );
};

/**
 * The browser's own zone, for displaying times. Unlike getUserTimezone it is
 * never snapped to a supported zone, so a viewer in Adelaide or Kathmandu
 * sees their real clock rather than the nearest listed city's.
 */
const getViewerTimezone = (): string => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timezone !== "" && isValidTimezone(timezone) ? timezone : getUserTimezone();
};

export {
  COMMON_TIMEZONES,
  DEFAULT_MEMBER_TIMEZONE,
  DEFAULT_WORKING_HOURS_END,
  DEFAULT_WORKING_HOURS_START,
  MINUTES_IN_DAY,
  formatDuration,
  formatMinuteOfDay,
  formatMinuteRange,
  formatTimeUntilAvailable,
  formatTimezoneCity,
  formatTimezoneLabel,
  formatUtcOffset,
  fuzzyMatchTimezone,
  getDayOffset,
  getMinuteOfDay,
  getMinutesUntilAvailable,
  getMinutesUntilDayEnds,
  getOffsetMinutes,
  getUserTimezone,
  getViewerTimezone,
  getWorkingInterval,
  isCommonTimezone,
  isCurrentlyWorking,
  isMinuteInInterval,
  wrapMinutes,
};

export type { CommonTimezone, WorkingInterval };
