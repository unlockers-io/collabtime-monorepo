"use client";

import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { CheckCircle, XCircle } from "lucide-react";

import { formatTimezoneLabel } from "@/lib/timezones";

import type { ParsedRow } from "./parse-csv";

type PreviewTableProps = {
  invalidCount: number;
  rows: Array<ParsedRow>;
  validCount: number;
};

const PreviewTable = ({ invalidCount, rows, validCount }: PreviewTableProps) => (
  <div className="flex flex-col gap-3 py-2">
    <div className="flex items-center gap-3 text-sm">
      {validCount > 0 && (
        <span className="flex items-center gap-1.5 font-medium text-success">
          <CheckCircle className="h-4 w-4" />
          {validCount} valid
        </span>
      )}
      {invalidCount > 0 && (
        <span className="flex items-center gap-1.5 text-destructive">
          <XCircle className="h-4 w-4" />
          {invalidCount} will be skipped
        </span>
      )}
    </div>

    <ScrollArea className="max-h-80 rounded-lg border border-border">
      <TooltipProvider delay={200}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Name
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Timezone
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Title
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
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
                  className={`border-b border-border last:border-0 ${isValid ? "" : "opacity-50"}`}
                  key={row.index}
                >
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{row.index}</td>
                  <td className="px-3 py-2 font-medium">
                    {row.name || <span className="text-destructive italic">missing</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.matchedTimezone ? (
                      <span>
                        {formatTimezoneLabel(row.matchedTimezone)}
                        {row.rawTimezone !== row.matchedTimezone && (
                          <span className="ml-1 text-xs opacity-60">(from {row.rawTimezone})</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-destructive">{row.rawTimezone || "missing"}</span>
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
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <Tooltip>
                        <TooltipTrigger render={<span className="inline-flex cursor-default" />}>
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
);

export { PreviewTable };
