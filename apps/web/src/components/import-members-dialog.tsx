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
import { toast } from "@repo/ui/components/sonner";
import { Spinner } from "@repo/ui/components/spinner";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Users } from "lucide-react";
import { useState } from "react";

import { teamQueryKeys } from "@/hooks/use-team-query";
import { importMembers } from "@/lib/actions/member-actions";

import type { ParsedRow } from "./import-members-dialog/parse-csv";
import { parseCSV } from "./import-members-dialog/parse-csv";
import { PreviewTable } from "./import-members-dialog/preview-table";
import { UploadForm } from "./import-members-dialog/upload-form";

type ImportMembersDialogProps = {
  teamId: string;
};

/**
 * The step carries its own rows, so "importing with nothing parsed" cannot be
 * expressed. A nullable row list plus an isImporting flag let Back stay live
 * during a submit, and the in-flight response then closed the dialog on a user
 * who had already gone back to paste something new.
 */
type ImportState =
  | { step: "upload" }
  | { rows: Array<ParsedRow>; step: "preview" }
  | { rows: Array<ParsedRow>; step: "importing" };

const ImportMembersDialog = ({ teamId }: ImportMembersDialogProps) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [state, setState] = useState<ImportState>({ step: "upload" });

  const handleReset = () => {
    setCsvText("");
    setState({ step: "upload" });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      handleReset();
    }
    setOpen(next);
  };

  const handleFileRead = (text: string) => {
    setCsvText(text);
    setState({ rows: parseCSV(text), step: "preview" });
  };

  const handlePreview = () => {
    if (!csvText.trim()) {
      return;
    }
    setState({ rows: parseCSV(csvText), step: "preview" });
  };

  const handleImport = async (rows: Array<ParsedRow>) => {
    const valid = rows.flatMap((r) =>
      r.errors.length === 0 && r.matchedTimezone !== null
        ? [
            {
              name: r.name,
              timezone: r.matchedTimezone,
              title: r.title,
              workingHoursEnd: r.workingHoursEnd,
              workingHoursStart: r.workingHoursStart,
            },
          ]
        : [],
    );
    if (valid.length === 0) {
      return;
    }

    setState({ rows, step: "importing" });
    const result = await importMembers(teamId, valid);

    if (result.success) {
      void queryClient.invalidateQueries({ queryKey: teamQueryKeys.team(teamId) });
      toast.success(
        `${result.data.imported} member${result.data.imported === 1 ? "" : "s"} imported`,
      );
      handleOpenChange(false);
      return;
    }

    toast.error(result.error);
    setState({ rows, step: "preview" });
  };

  const rows = state.step === "upload" ? null : state.rows;
  const validCount = rows?.filter((r) => r.errors.length === 0).length ?? 0;
  const invalidCount = (rows?.length ?? 0) - validCount;

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger render={<Button size="sm" type="button" variant="outline" />}>
        <Upload className="size-4" />
        Import from CSV
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        {open && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary">
                  <Users className="size-5 text-primary-foreground" />
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
              {state.step === "upload" && (
                <>
                  <Button
                    onClick={() => {
                      handleOpenChange(false);
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button disabled={!csvText.trim()} onClick={handlePreview}>
                    Preview →
                  </Button>
                </>
              )}
              {state.step === "preview" && (
                <>
                  <Button onClick={handleReset} variant="outline">
                    ← Back
                  </Button>
                  <Button
                    disabled={validCount === 0}
                    onClick={() => {
                      void handleImport(state.rows);
                    }}
                  >
                    {`Import ${validCount} member${validCount === 1 ? "" : "s"}`}
                  </Button>
                </>
              )}
              {state.step === "importing" && (
                <Button disabled>
                  <span className="flex items-center gap-2">
                    <Spinner />
                    Importing…
                  </span>
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export { ImportMembersDialog };
