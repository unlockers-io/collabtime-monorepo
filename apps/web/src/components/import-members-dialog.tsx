"use client";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Spinner } from "@repo/ui/components/spinner";
import { Upload, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { importMembers } from "@/lib/actions/member-actions";
import type { COMMON_TIMEZONES } from "@/lib/timezones";

import type { ParsedRow } from "./import-members-dialog/parse-csv";
import { parseCSV } from "./import-members-dialog/parse-csv";
import { PreviewTable } from "./import-members-dialog/preview-table";
import { UploadForm } from "./import-members-dialog/upload-form";

type ImportMembersDialogProps = {
  teamId: string;
};

const ImportMembersDialog = ({ teamId }: ImportMembersDialogProps) => {
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<Array<ParsedRow> | null>(null);
  const [isImporting, setIsImporting] = useState(false);

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
        workingHoursEnd: r.workingHoursEnd,
        workingHoursStart: r.workingHoursStart,
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
    // Controlled: needs programmatic close on successful import and to reset
    // CSV/parsed-rows state when the dialog closes.
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger
        render={
          <Button
            className="group flex h-9 w-full items-center justify-center gap-2 text-muted-foreground"
            type="button"
            variant="outline"
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
              <DialogTitle className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
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
              <UploadForm
                csvText={csvText}
                onCsvTextChange={setCsvText}
                onFileRead={handleFileRead}
              />
            ) : (
              <PreviewTable invalidCount={invalidCount} rows={rows} validCount={validCount} />
            )}

            <DialogFooter>
              {rows === null ? (
                <>
                  <Button onClick={() => handleOpenChange(false)} variant="outline">
                    Cancel
                  </Button>
                  <Button disabled={!csvText.trim()} onClick={handlePreview}>
                    Preview →
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={handleReset} variant="outline">
                    ← Back
                  </Button>
                  <Button disabled={isImporting || validCount === 0} onClick={handleImport}>
                    {isImporting ? (
                      <span className="flex items-center gap-2">
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
