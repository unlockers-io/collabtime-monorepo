"use client";

import { Pencil } from "lucide-react";

import { cn } from "@/lib/utils";

type TeamTitleProps = {
  isAdmin: boolean;
  isEditing: boolean;
  onCancel: () => void;
  onChange: (name: string) => void;
  onEdit: () => void;
  onSave: () => void;
  teamName: string;
};

const TeamTitle = ({
  isAdmin,
  isEditing,
  onCancel,
  onChange,
  onEdit,
  onSave,
  teamName,
}: TeamTitleProps) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  if (!isAdmin) {
    return (
      <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
        {teamName || "Team Workspace"}
      </h1>
    );
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        className="h-9 w-full max-w-48 rounded-lg border border-input bg-background px-3 text-base font-bold tracking-tight text-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 focus:outline-none sm:text-lg"
        onBlur={onSave}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Team name…"
        type="text"
        value={teamName}
      />
    );
  }

  return (
    <button className="group flex min-w-0 items-center gap-2" onClick={onEdit} type="button">
      <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
        {teamName || "Team Workspace"}
      </h1>
      <Pencil
        className={cn(
          "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-opacity",
          teamName ? "opacity-0 group-hover:opacity-100" : "opacity-100",
        )}
      />
    </button>
  );
};

export { TeamTitle };
