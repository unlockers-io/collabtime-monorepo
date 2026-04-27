"use client";

import { Textarea } from "@repo/ui/components/textarea";
import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { downloadTemplate } from "./parse-csv";

type UploadFormProps = {
  csvText: string;
  onCsvTextChange: (text: string) => void;
  onFileRead: (text: string) => void;
};

const UploadForm = ({ csvText, onCsvTextChange, onFileRead }: UploadFormProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }
    const text = await file.text();
    onFileRead(text);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    onFileRead(text);
  };

  return (
    <div className="flex flex-col gap-4 py-2">
      {/* Drop zone */}
      <button
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/50 hover:border-muted-foreground hover:bg-muted"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDrop={handleDrop}
        type="button"
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Drop a CSV file here, or click to browse</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Accepts .csv files and tab-separated spreadsheet pastes
          </p>
        </div>
        <input
          accept=".csv,text/csv,text/plain"
          className="sr-only"
          onChange={handleFileUpload}
          ref={fileInputRef}
          tabIndex={-1}
          type="file"
        />
      </button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or paste below</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Textarea
        className="h-32 resize-none font-mono text-xs"
        onChange={(e) => onCsvTextChange(e.target.value)}
        placeholder={`name,timezone,title,work_start,work_end\nAlice Johnson,America/New_York,Engineering Lead,9,17`}
        spellCheck={false}
        value={csvText}
      />

      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={downloadTemplate}
          type="button"
        >
          <Download className="h-3.5 w-3.5" />
          Download template
        </button>
        <p className="text-xs text-muted-foreground">
          Columns: name, timezone, title, work_start, work_end
        </p>
      </div>
    </div>
  );
};

export { UploadForm };
