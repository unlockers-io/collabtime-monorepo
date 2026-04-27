import type { COMMON_TIMEZONES } from "@/lib/timezones";
import { fuzzyMatchTimezone } from "@/lib/timezones";

type ParsedRow = {
  errors: Array<string>;
  index: number;
  matchedTimezone: (typeof COMMON_TIMEZONES)[number] | null;
  name: string;
  rawTimezone: string;
  title: string;
  workingHoursEnd: number;
  workingHoursStart: number;
};

const TEMPLATE_CSV = [
  "name,timezone,title,work_start,work_end",
  "Alice Johnson,America/New_York,Engineering Lead,9,17",
  "Bob Smith,Europe/London,Product Manager,8,17",
  "Carol Kim,Asia/Tokyo,Designer,9,18",
].join("\n");

const normalizeHeader = (h: string) => h.toLowerCase().replaceAll(/[\s_-]/g, "");

const findColIndex = (headers: Array<string>, ...names: Array<string>): number => {
  for (const name of names) {
    const idx = headers.indexOf(normalizeHeader(name));
    if (idx !== -1) {
      return idx;
    }
  }
  return -1;
};

const parseCSVLine = (line: string, sep: string): Array<string> => {
  if (sep === "\t") {
    return line.split("\t").map((s) => s.trim());
  }

  const cells: Array<string> = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (c === "," && !inQ) {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  cells.push(cur.trim());
  return cells;
};

const parseCSV = (text: string): Array<ParsedRow> => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) {
    return [];
  }

  const firstLine = lines[0];
  const sep =
    (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? "\t" : ",";

  let startRow = 0;
  // null = column not present (only valid when header row detected)
  let nameIdx: number | null = 0;
  let tzIdx: number | null = 1;
  let titleIdx: number | null = 2;
  let startIdx: number | null = 3;
  let endIdx: number | null = 4;

  const firstCells = parseCSVLine(firstLine, sep).map(normalizeHeader);

  const hasHeader =
    firstCells.includes("name") || firstCells.includes("timezone") || firstCells.includes("tz");

  if (hasHeader) {
    startRow = 1;
    // Use null when a column isn't found — don't fall back to positional defaults
    // so we don't silently read the wrong column.
    nameIdx = findColIndex(firstCells, "name");
    tzIdx = findColIndex(firstCells, "timezone", "tz");
    titleIdx = findColIndex(firstCells, "title", "role", "position");
    startIdx = findColIndex(firstCells, "workstart", "workhourstart", "workinghoursstart", "start");
    endIdx = findColIndex(firstCells, "workend", "workhourend", "workinghoursend", "end");
  }

  const rows: Array<ParsedRow> = [];

  for (let i = startRow; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i], sep);
    if (cells.every((c) => !c)) {
      continue;
    }

    const name = (nameIdx !== null ? (cells[nameIdx] ?? "") : "").trim();
    const rawTimezone = (tzIdx !== null ? (cells[tzIdx] ?? "") : "").trim();
    const title = (titleIdx !== null ? (cells[titleIdx] ?? "") : "").trim();
    const workStartRaw = (startIdx !== null ? (cells[startIdx] ?? "9") : "9").trim();
    const workEndRaw = (endIdx !== null ? (cells[endIdx] ?? "17") : "17").trim();

    const matchedTimezone = rawTimezone ? fuzzyMatchTimezone(rawTimezone) : null;
    const workStart = Number.parseInt(workStartRaw, 10);
    const workEnd = Number.parseInt(workEndRaw, 10);

    const errors: Array<string> = [];
    if (!name) {
      errors.push("Name is required");
    }
    if (name.length > 100) {
      errors.push("Name too long (max 100 chars)");
    }
    if (!rawTimezone) {
      errors.push("Timezone is required");
    } else if (!matchedTimezone) {
      errors.push(`Unknown timezone: "${rawTimezone}"`);
    }
    if (Number.isNaN(workStart) || workStart < 0 || workStart > 23) {
      errors.push("Work start must be 0–23");
    }
    if (Number.isNaN(workEnd) || workEnd < 0 || workEnd > 23) {
      errors.push("Work end must be 0–23");
    }

    rows.push({
      errors,
      index: i - startRow + 1,
      matchedTimezone,
      name,
      rawTimezone,
      title,
      workingHoursEnd: Number.isNaN(workEnd) ? 17 : workEnd,
      workingHoursStart: Number.isNaN(workStart) ? 9 : workStart,
    });
  }

  return rows;
};

const downloadTemplate = () => {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "team-members-template.csv";
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export type { ParsedRow };
export { downloadTemplate, parseCSV };
