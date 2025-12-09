"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Users } from "lucide-react";
import type { TeamGroup } from "@/types";
import { removeGroup, updateGroup } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type GroupHeaderProps = {
  group: TeamGroup;
  teamId: string;
  memberCount: number;
  onGroupUpdated: (group: TeamGroup) => void;
  onGroupRemoved: (groupId: string) => void;
  onMemberDropped?: (memberId: string, groupId: string) => void;
};

const GroupHeader = ({
  group,
  teamId,
  memberCount,
  onGroupUpdated,
  onGroupRemoved,
  onMemberDropped,
}: GroupHeaderProps) => {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  const handleStartEditing = useCallback(() => {
    setEditingName(group.name);
    setIsEditing(true);
  }, [group.name]);

  const handleSave = useCallback(() => {
    const trimmedName = editingName.trim();
    if (!trimmedName || trimmedName === group.name) {
      setIsEditing(false);
      return;
    }

    setIsEditing(false);
    startTransition(async () => {
      const result = await updateGroup(teamId, group.id, { name: trimmedName });
      if (result.success) {
        onGroupUpdated({ ...group, name: trimmedName });
      } else {
        toast.error(result.error);
      }
    });
  }, [editingName, group, teamId, onGroupUpdated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeGroup(teamId, group.id);
      if (result.success) {
        onGroupRemoved(group.id);
        toast.success(`Group "${group.name}" removed`);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const memberId = e.dataTransfer.getData("text/plain");
    if (memberId && onMemberDropped) {
      onMemberDropped(memberId, group.id);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl px-4 py-3 transition-colors",
        isDragOver
          ? "bg-neutral-200 ring-2 ring-neutral-400 ring-inset dark:bg-neutral-700 dark:ring-neutral-500"
          : "bg-neutral-100 dark:bg-neutral-800"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
          <Users className="h-5 w-5" />
        </div>

        {isEditing ? (
          <Input
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-9 flex-1 text-sm font-medium"
          />
        ) : (
          <button
            type="button"
            onClick={handleStartEditing}
            className="group flex min-w-0 items-center gap-1.5 font-semibold text-neutral-900 dark:text-neutral-100"
          >
            <span className="truncate">{group.name}</span>
            <Pencil className="h-4 w-4 shrink-0 text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}

        <span className="shrink-0 rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-medium tabular-nums text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
          {memberCount}
        </span>

        {isDragOver && (
          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
            Drop to add
          </span>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleRemove}
        disabled={isPending}
        className="shrink-0 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
        aria-label={`Remove group ${group.name}`}
      >
        {isPending ? <Spinner /> : <Trash2 className="h-4 w-4" />}
      </Button>
    </div>
  );
};

export { GroupHeader };
