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
import { useDrag } from "@/contexts/drag-context";

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
  const { isDragging } = useDrag();

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
        "group flex h-full min-h-[180px] flex-col rounded-2xl p-4 transition-all",
        isDragOver
          ? "bg-neutral-200 ring-2 ring-neutral-900 ring-inset dark:bg-neutral-700 dark:ring-neutral-100"
          : isDragging
            ? "bg-neutral-100 ring-2 ring-dashed ring-neutral-300 dark:bg-neutral-800 dark:ring-neutral-600"
            : "bg-neutral-100 dark:bg-neutral-800"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Top row: Icon and Actions */}
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
          <Users className="h-6 w-6" />
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleRemove}
          disabled={isPending}
          className="shrink-0 text-neutral-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          aria-label={`Remove group ${group.name}`}
        >
          {isPending ? <Spinner /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Group info - stacked vertically */}
      <div className="mt-3 flex flex-1 flex-col gap-2">
        {isEditing ? (
          <Input
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-9 text-sm font-medium"
          />
        ) : (
          <button
            type="button"
            onClick={handleStartEditing}
            className="group/name flex items-center gap-1.5 text-left"
          >
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              {group.name}
            </span>
            <Pencil className="h-3.5 w-3.5 shrink-0 text-neutral-400 opacity-0 transition-opacity group-hover/name:opacity-100" />
          </button>
        )}

        {/* Member count badge */}
        <div className="mt-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-medium tabular-nums text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
            <Users className="h-3 w-3" />
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </span>
        </div>

        {/* Drop indicator */}
        {(isDragging || isDragOver) && (
          <div className={cn(
            "mt-2 flex items-center justify-center rounded-xl border-2 border-dashed py-3 text-sm font-medium transition-colors",
            isDragOver
              ? "border-neutral-400 bg-neutral-100 text-neutral-900 dark:border-neutral-500 dark:bg-neutral-600 dark:text-neutral-100"
              : "border-neutral-300 text-neutral-500 dark:border-neutral-600 dark:text-neutral-400"
          )}>
            Drop here to add
          </div>
        )}
      </div>
    </div>
  );
};

export { GroupHeader };
