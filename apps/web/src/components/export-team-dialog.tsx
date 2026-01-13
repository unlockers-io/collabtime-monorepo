"use client";

import { useState } from "react";
import { Download, FileJson, FileSpreadsheet, Crown } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Spinner,
} from "@repo/ui";

type ExportTeamDialogProps = {
  teamId: string;
  teamName: string;
  isPro: boolean;
  hasSpace: boolean;
};

const ExportTeamDialog = ({
  teamId,
  teamName,
  isPro,
  hasSpace,
}: ExportTeamDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<"csv" | "json">("csv");

  const handleExport = async () => {
    if (!isPro) {
      toast.error("Export requires PRO subscription");
      return;
    }

    setIsExporting(true);

    try {
      const response = await fetch(
        `/api/teams/${teamId}/export?format=${format}`
      );

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 402) {
          toast.error("Export requires PRO subscription");
        } else {
          toast.error(data.error ?? "Failed to export team");
        }
        return;
      }

      // Get the blob and create download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${teamName || "team"}-export.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Team exported as ${format.toUpperCase()}`);
      setOpen(false);
    } catch {
      toast.error("Failed to export team");
    } finally {
      setIsExporting(false);
    }
  };

  // If user doesn't have a space or isn't PRO, show upgrade prompt
  const showUpgradePrompt = !hasSpace || !isPro;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export</span>
          {!isPro && (
            <Crown className="h-3 w-3 text-amber-500" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Download className="h-5 w-5 text-primary-foreground" />
            </div>
            <DialogTitle>Export Team Data</DialogTitle>
          </div>
          <DialogDescription>
            Download your team&apos;s timezone and working hours data.
          </DialogDescription>
        </DialogHeader>

        {showUpgradePrompt ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Crown className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold text-foreground">PRO Feature</h3>
              <p className="text-sm text-muted-foreground">
                {!hasSpace
                  ? "Claim this team and upgrade to PRO to export data."
                  : "Upgrade to PRO to export team data as CSV or JSON."}
              </p>
            </div>
            <a
              href="/settings"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-amber-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
            >
              <Crown className="h-4 w-4" />
              Upgrade to PRO
            </a>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Export Format</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={format === "csv" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormat("csv")}
                    className="flex-1"
                  >
                    <span className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      CSV
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant={format === "json" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormat("json")}
                    className="flex-1"
                  >
                    <span className="flex items-center gap-2">
                      <FileJson className="h-4 w-4" />
                      JSON
                    </span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format === "csv"
                    ? "Best for spreadsheets (Excel, Google Sheets)"
                    : "Best for developers and integrations"}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isExporting}
              >
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <span className="flex items-center gap-2">
                    <Spinner />
                    Exporting…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export
                  </span>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export { ExportTeamDialog };
