import { COMMON_TIMEZONES, formatTimezoneLabel } from "@/lib/timezones";

type Timezone = (typeof COMMON_TIMEZONES)[number];

type TimezoneOption = {
  city: string;
  label: string;
  offset: string;
  search: string;
};

const LABEL_PATTERN = /^(?<city>.+?) \((?<offset>[^\(\)]+)\)$/v;
const GMT_OFFSET_PATTERN = /^GMT(?:(?<sign>[+\-])(?<hours>\d{1,2})(?::(?<minutes>\d{2}))?)?$/v;

const normalizeSearchText = (text: string): string =>
  text
    .normalize("NFD")
    .replaceAll(/\p{M}/gv, "")
    .replaceAll(/[−–]/gv, "-")
    .replaceAll(/[\/_\(\),]/gv, " ")
    .toLowerCase();

const formatZoneName = (timezone: string, timeZoneName: "longGeneric" | "short" | "shortOffset") =>
  new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value ?? "";

// Lets "UTC+5:30", "GMT+05:30" and "+0530" all find the same zone, whatever the label shows.
const getOffsetAliases = (timezone: string): Array<string> => {
  const groups = GMT_OFFSET_PATTERN.exec(formatZoneName(timezone, "shortOffset"))?.groups;
  const sign = groups?.sign ?? "+";
  const hours = groups?.hours ?? "0";
  const minutes = groups?.minutes ?? "00";
  const paddedHours = hours.padStart(2, "0");
  const offsets = [
    `${sign}${hours}`,
    `${sign}${hours}:${minutes}`,
    `${sign}${paddedHours}:${minutes}`,
    `${sign}${paddedHours}${minutes}`,
  ];
  return offsets.flatMap((offset) => [`utc${offset}`, `gmt${offset}`]);
};

const buildOption = (timezone: Timezone): TimezoneOption => {
  const label = formatTimezoneLabel(timezone);
  const parts = LABEL_PATTERN.exec(label)?.groups;
  const search = [
    label,
    timezone,
    formatZoneName(timezone, "longGeneric"),
    formatZoneName(timezone, "short"),
    ...getOffsetAliases(timezone),
  ].join(" ");

  return {
    city: parts?.city ?? label,
    label,
    offset: parts?.offset ?? "",
    search: normalizeSearchText(search),
  };
};

const HOUR_MS = 3_600_000;

// Offsets move with daylight saving, so a cached option only lives for the hour it was built in.
const optionCache = new Map<Timezone, { hour: number; option: TimezoneOption }>();

const getTimezoneOption = (timezone: Timezone): TimezoneOption => {
  const hour = Math.floor(Date.now() / HOUR_MS);
  const cached = optionCache.get(timezone);
  if (cached?.hour === hour) {
    return cached.option;
  }
  const option = buildOption(timezone);
  optionCache.set(timezone, { hour, option });
  return option;
};

const matchesTimezoneQuery = (timezone: Timezone, query: string): boolean => {
  const tokens = normalizeSearchText(query).split(/\s+/v).filter(Boolean);
  const { search } = getTimezoneOption(timezone);
  return tokens.every((token) => search.includes(token));
};

const TIMEZONE_ITEMS: Array<Timezone> = [...COMMON_TIMEZONES];

export type { Timezone };
export { getTimezoneOption, matchesTimezoneQuery, TIMEZONE_ITEMS };
