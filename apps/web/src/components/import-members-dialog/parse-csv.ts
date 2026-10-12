import { NO_GROUP, toMemberInput } from "@/lib/member-input";
import type { MemberInput } from "@/lib/member-input";
import { fuzzyMatchTimezone } from "@/lib/timezones";
import { TeamMemberInputSchema } from "@/lib/validation";

type ParsedRow = {
  errors: Array<string>;
  index: number;
  member: MemberInput;
  rawTimezone: string;
};

const TEMPLATE_CSV = [
  "name,timezone,title,work_start,work_end",
  "Alice Johnson,America/New_York,Engineering Lead,9,17",
  "Bob Smith,Europe/London,Product Manager,8,17",
  "Carol Kim,Asia/Tokyo,Designer,9,18",
].join("\n");

const normalizeHeader = (h: string) => h.toLowerCase().replaceAll(/[\s_\-]/gv, "");

const findColIndex = (headerIndices: Map<string, number>, ...names: Array<string>): number => {
  for (const name of names) {
    const idx = headerIndices.get(normalizeHeader(name));
    if (idx !== undefined) {
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

const parseHour = (cell: string) => (cell ? Math.trunc(Number(cell)) : Number.NaN);

const describeTimezoneError = (rawTimezone: string) =>
  rawTimezone ? `Unknown timezone: "${rawTimezone}"` : "Timezone is required";

const parseCSV = (text: string): Array<ParsedRow> => {
  const lines = text.split(/\r?\n/v).filter((l) => l.trim());
  const [firstLine] = lines;
  if (firstLine === undefined) {
    return [];
  }

  const sep =
    (firstLine.match(/\t/gv)?.length ?? 0) > (firstLine.match(/,/gv)?.length ?? 0) ? "\t" : ",";

  let startRow = 0;
  let nameIdx = 0;
  let tzIdx = 1;
  let titleIdx = 2;
  let startIdx = 3;
  let endIdx = 4;

  const firstCells = parseCSVLine(firstLine, sep).map(normalizeHeader);

  const hasHeader =
    firstCells.includes("name") || firstCells.includes("timezone") || firstCells.includes("tz");

  if (hasHeader) {
    startRow = 1;
    const headerIndices = new Map<string, number>();
    for (const [i, cell] of firstCells.entries()) {
      if (!headerIndices.has(cell)) {
        headerIndices.set(cell, i);
      }
    }
    nameIdx = findColIndex(headerIndices, "name");
    tzIdx = findColIndex(headerIndices, "timezone", "tz");
    titleIdx = findColIndex(headerIndices, "title", "role", "position");
    startIdx = findColIndex(
      headerIndices,
      "workstart",
      "workhourstart",
      "workinghoursstart",
      "start",
    );
    endIdx = findColIndex(headerIndices, "workend", "workhourend", "workinghoursend", "end");
  }

  const rows: Array<ParsedRow> = [];

  for (const [offset, line] of lines.slice(startRow).entries()) {
    const cells: ReadonlyArray<string | undefined> = parseCSVLine(line, sep);
    if (cells.every((c) => c === "")) {
      continue;
    }

    const rawTimezone = cells[tzIdx] ?? "";
    const member = toMemberInput({
      groupId: NO_GROUP,
      name: cells[nameIdx] ?? "",
      timezone: fuzzyMatchTimezone(rawTimezone) ?? rawTimezone,
      title: cells[titleIdx] ?? "",
      workingHoursEnd: parseHour(cells[endIdx] ?? "17"),
      workingHoursStart: parseHour(cells[startIdx] ?? "9"),
    });
    const result = TeamMemberInputSchema.safeParse(member);

    rows.push({
      errors: result.success
        ? []
        : result.error.issues.map((issue) =>
            issue.path[0] === "timezone" ? describeTimezoneError(rawTimezone) : issue.message,
          ),
      index: offset + 1,
      member,
      rawTimezone,
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
