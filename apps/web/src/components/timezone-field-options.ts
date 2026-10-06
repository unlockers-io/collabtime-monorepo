import {
  COMMON_TIMEZONES,
  formatTimezoneCity,
  formatTimezoneLabel,
  formatUtcOffset,
  getOffsetMinutes,
} from "@/lib/timezones";
import type { CommonTimezone } from "@/lib/timezones";

type TimezoneOption = {
  city: string;
  label: string;
  offset: string;
  search: string;
};

const normalizeSearchText = (text: string): string =>
  text
    .normalize("NFD")
    .replaceAll(/\p{M}/gv, "")
    .replaceAll(/[−–]/gv, "-")
    .replaceAll(/[\/_\(\),]/gv, " ")
    .toLowerCase();

const formatZoneName = (
  timezone: string,
  timeZoneName: "longGeneric" | "short",
  at: Date,
): string =>
  new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value ?? "";

// Lets "UTC+5:30", "GMT+05:30" and "+0530" all find the same zone, whatever the label shows.
const getOffsetAliases = (timezone: string, at: Date): Array<string> => {
  const offset = getOffsetMinutes(timezone, at);
  const sign = offset < 0 ? "-" : "+";
  const hours = Math.floor(Math.abs(offset) / 60).toString();
  const minutes = (Math.abs(offset) % 60).toString().padStart(2, "0");
  const paddedHours = hours.padStart(2, "0");
  const offsets = [
    `${sign}${hours}`,
    `${sign}${hours}:${minutes}`,
    `${sign}${paddedHours}:${minutes}`,
    `${sign}${paddedHours}${minutes}`,
  ];
  return offsets.flatMap((alias) => [`utc${alias}`, `gmt${alias}`]);
};

const buildOption = (timezone: CommonTimezone, at: Date): TimezoneOption => {
  const label = formatTimezoneLabel(timezone, at);
  const search = [
    label,
    timezone,
    formatZoneName(timezone, "longGeneric", at),
    formatZoneName(timezone, "short", at),
    ...getOffsetAliases(timezone, at),
  ].join(" ");

  return {
    city: formatTimezoneCity(timezone),
    label,
    offset: formatUtcOffset(timezone, at),
    search: normalizeSearchText(search),
  };
};

const HOUR_MS = 3_600_000;

// Offsets move with daylight saving, so a cached option only lives for the hour it was built in.
const optionCache = new Map<CommonTimezone, { hour: number; option: TimezoneOption }>();

const getTimezoneOption = (timezone: CommonTimezone): TimezoneOption => {
  const now = new Date();
  const hour = Math.floor(now.getTime() / HOUR_MS);
  const cached = optionCache.get(timezone);
  if (cached?.hour === hour) {
    return cached.option;
  }
  const option = buildOption(timezone, now);
  optionCache.set(timezone, { hour, option });
  return option;
};

const matchesTimezoneQuery = (timezone: CommonTimezone, query: string): boolean => {
  const tokens = normalizeSearchText(query).split(/\s+/v).filter(Boolean);
  const { search } = getTimezoneOption(timezone);
  return tokens.every((token) => search.includes(token));
};

const TIMEZONE_ITEMS: Array<CommonTimezone> = [...COMMON_TIMEZONES];

export { getTimezoneOption, matchesTimezoneQuery, TIMEZONE_ITEMS };
