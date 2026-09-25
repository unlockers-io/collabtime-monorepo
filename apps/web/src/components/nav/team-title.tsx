"use client";

import { Button } from "@repo/ui/components/button";
import { Pencil } from "lucide-react";

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

  const heading = (
    <h1 className="min-w-0 font-display text-4xl font-semibold tracking-hero text-balance break-words sm:text-6xl">
      {teamName || "Untitled workspace"}
    </h1>
  );

  if (!isAdmin) {
    return heading;
  }

  if (isEditing) {
    return (
      <input
        aria-label="Workspace name"
        autoFocus
        className="h-14 w-full max-w-xl border border-input bg-background px-3 font-display text-3xl font-semibold tracking-hero text-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 focus:outline-none sm:h-18 sm:text-5xl"
        maxLength={100}
        onBlur={onSave}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        onFocus={(e) => {
          e.currentTarget.select();
        }}
        onKeyDown={handleKeyDown}
        placeholder="Workspace name"
        type="text"
        value={teamName}
      />
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {heading}
      <Button
        aria-label="Rename workspace"
        className="shrink-0"
        onClick={onEdit}
        size="icon-sm"
        variant="ghost"
      >
        <Pencil aria-hidden className="size-4" />
      </Button>
    </div>
  );
};

export { TeamTitle };
