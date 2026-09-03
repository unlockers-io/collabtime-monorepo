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
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === "Enter") {
      onSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  if (!isAdmin) {
    return (
      <h1 className="truncate font-display text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
        {teamName || "Team Workspace"}
      </h1>
    );
  }

  if (isEditing) {
    return (
      <input
        aria-label="Team name"
        autoFocus
        className="h-14 w-full max-w-xl border border-input bg-background px-3 font-display text-3xl font-semibold tracking-[-0.04em] text-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 focus:outline-none sm:h-18 sm:text-5xl"
        onBlur={onSave}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        onFocus={(e) => {
          e.currentTarget.select();
        }}
        onKeyDown={handleKeyDown}
        placeholder="Team name…"
        type="text"
        value={teamName}
      />
    );
  }

  return (
    <button
      aria-label="Edit team name"
      className="group flex min-w-0 items-center gap-2"
      onClick={onEdit}
      type="button"
    >
      <h1 className="truncate font-display text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
        {teamName || "Team Workspace"}
      </h1>
      <Pencil
        aria-hidden="true"
        className={cn(
          "size-3.5 shrink-0 text-muted-foreground transition-opacity",
          teamName
            ? "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
            : "opacity-100",
        )}
      />
    </button>
  );
};

export { TeamTitle };
