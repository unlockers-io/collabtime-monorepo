"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  ScrollArea,
  Spinner,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui";
import { CheckCircle, Download, Upload, Users, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { importMembers } from "@/lib/actions/member-actions";
import { COMMON_TIMEZONES, formatTimezoneLabel, fuzzyMatchTimezone } from "@/lib/timezones";

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

type ImportMembersDialogProps = {
  teamId: string;
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
      index: i - startRow + 1,
      name,
      rawTimezone,
      matchedTimezone,
      title,
      workingHoursStart: Number.isNaN(workStart) ? 9 : workStart,
      workingHoursEnd: Number.isNaN(workEnd) ? 17 : workEnd,
      errors,
    });
  }

  return rows;
};

const handleDownloadTemplate = () => {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "team-members-template.csv";
  document.body.append(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const ImportMembersDialog = ({ teamId }: ImportMembersDialogProps) => {
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<Array<ParsedRow> | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReset = () => {
    setCsvText("");
    setRows(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      handleReset();
    }
    setOpen(next);
  };

  const handleFileRead = (text: string) => {
    setCsvText(text);
    setRows(parseCSV(text));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => handleFileRead(ev.target?.result as string);
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => handleFileRead(ev.target?.result as string);
    reader.readAsText(file);
  };

  const handlePreview = () => {
    if (!csvText.trim()) {
      return;
    }
    setRows(parseCSV(csvText));
  };

  const handleImport = async () => {
    if (!rows) {
      return;
    }
    const valid = rows.filter((r) => r.errors.length === 0 && r.matchedTimezone);
    if (valid.length === 0) {
      return;
    }

    setIsImporting(true);
    const result = await importMembers(
      teamId,
      valid.map((r) => ({
        name: r.name,
        // matchedTimezone is guaranteed non-null here due to the filter above
        timezone: r.matchedTimezone as (typeof COMMON_TIMEZONES)[number],
        title: r.title,
        workingHoursStart: r.workingHoursStart,
        workingHoursEnd: r.workingHoursEnd,
      })),
    );
    setIsImporting(false);

    if (result.success) {
      toast.success(
        `${result.data.imported} member${result.data.imported === 1 ? "" : "s"} imported`,
      );
      handleOpenChange(false);
    } else {
      toast.error(result.error);
    }
  };

  const validCount = rows?.filter((r) => r.errors.length === 0).length ?? 0;
  const invalidCount = (rows?.length ?? 0) - validCount;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            type="button"
            className="group h-9 gap-2 flex w-full items-center justify-center text-muted-foreground"
          />
        }
      >
        <Upload className="h-4 w-4 transition-transform group-hover:scale-110" />
        <span className="text-sm font-medium">Import from CSV</span>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        {open && (
          <>
            <DialogHeader>
              <DialogTitle className="gap-3 flex items-center">
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary">
                  <Users className="h-5 w-5 text-primary-foreground" />
                </div>
                Import Members
              </DialogTitle>
              <DialogDescription>
                Upload a CSV file or paste data from a spreadsheet. Timezones are matched to the
                nearest supported one.
              </DialogDescription>
            </DialogHeader>

            {rows === null ? (
              <div className="gap-4 py-2 flex flex-col">
                {/* Drop zone */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`gap-3 px-6 py-8 flex flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/50 hover:border-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Drop a CSV file here, or click to browse</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Accepts .csv files and tab-separated spreadsheet pastes
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    className="sr-only"
                    onChange={handleFileUpload}
                    tabIndex={-1}
                  />
                </button>

                <div className="gap-3 flex items-center">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">or paste below</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <Textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`name,timezone,title,work_start,work_end\nAlice Johnson,America/New_York,Engineering Lead,9,17`}
                  className="h-32 font-mono text-xs resize-none"
                  spellCheck={false}
                />

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="gap-1.5 text-xs flex items-center text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download template
                  </button>
                  <p className="text-xs text-muted-foreground">
                    Columns: name, timezone, title, work_start, work_end
                  </p>
                </div>
              </div>
            ) : (
              <div className="gap-3 py-2 flex flex-col">
                <div className="gap-3 text-sm flex items-center">
                  {validCount > 0 && (
                    <span className="gap-1.5 font-medium text-green-600 dark:text-green-400 flex items-center">
                      <CheckCircle className="h-4 w-4" />
                      {validCount} valid
                    </span>
                  )}
                  {invalidCount > 0 && (
                    <span className="gap-1.5 flex items-center text-destructive">
                      <XCircle className="h-4 w-4" />
                      {invalidCount} will be skipped
                    </span>
                  )}
                </div>

                <ScrollArea className="max-h-80 rounded-lg border border-border">
                  <TooltipProvider delay={200}>
                    <table className="text-sm w-full">
                      <thead className="top-0 backdrop-blur-sm sticky bg-muted/80">
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 text-xs font-medium text-left text-muted-foreground">
                            #
                          </th>
                          <th className="px-3 py-2 text-xs font-medium text-left text-muted-foreground">
                            Name
                          </th>
                          <th className="px-3 py-2 text-xs font-medium text-left text-muted-foreground">
                            Timezone
                          </th>
                          <th className="px-3 py-2 text-xs font-medium text-left text-muted-foreground">
                            Title
                          </th>
                          <th className="px-3 py-2 text-xs font-medium text-left text-muted-foreground">
                            Hours
                          </th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const isValid = row.errors.length === 0;
                          return (
                            <tr
                              key={row.index}
                              className={`border-b border-border last:border-0 ${isValid ? "" : "opacity-50"}`}
                            >
                              <td className="px-3 py-2 text-muted-foreground tabular-nums">
                                {row.index}
                              </td>
                              <td className="px-3 py-2 font-medium">
                                {row.name || (
                                  <span className="text-destructive italic">missing</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {row.matchedTimezone ? (
                                  <span>
                                    {formatTimezoneLabel(row.matchedTimezone)}
                                    {row.rawTimezone !== row.matchedTimezone && (
                                      <span className="ml-1 text-xs opacity-60">
                                        (from {row.rawTimezone})
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-destructive">
                                    {row.rawTimezone || "missing"}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {row.title || <span className="opacity-40">—</span>}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                                {row.workingHoursStart}:00–{row.workingHoursEnd}:00
                              </td>
                              <td className="px-3 py-2">
                                {isValid ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={<span className="inline-flex cursor-default" />}
                                    >
                                      <XCircle className="h-4 w-4 text-destructive" />
                                    </TooltipTrigger>
                                    <TooltipContent>{row.errors.join(" · ")}</TooltipContent>
                                  </Tooltip>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </TooltipProvider>
                </ScrollArea>
              </div>
            )}

            <DialogFooter>
              {rows === null ? (
                <>
                  <Button variant="outline" onClick={() => handleOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handlePreview} disabled={!csvText.trim()}>
                    Preview →
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={handleReset}>
                    ← Back
                  </Button>
                  <Button onClick={handleImport} disabled={isImporting || validCount === 0}>
                    {isImporting ? (
                      <span className="gap-2 flex items-center">
                        <Spinner />
                        Importing…
                      </span>
                    ) : (
                      `Import ${validCount} member${validCount === 1 ? "" : "s"}`
                    )}
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export { ImportMembersDialog };
