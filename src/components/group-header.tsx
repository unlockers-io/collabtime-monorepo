"use client";

import { useCallback, useState, useTransition } from "react";
import { motion } from "motion/react";
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
        "group relative flex h-full min-h-[180px] flex-col rounded-2xl border-2 p-4 transition-all",
        isDragOver
          ? "border-neutral-900 bg-neutral-200 dark:border-neutral-100 dark:bg-neutral-700"
          : "border-transparent bg-neutral-100 dark:bg-neutral-800"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Animated marching ants border */}
      {isDragging && !isDragOver && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <motion.rect
            x="1"
            y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            rx="15"
            ry="15"
            fill="none"
            className="stroke-neutral-400 dark:stroke-neutral-500"
            strokeWidth="2"
            strokeDasharray="8 8"
            initial={{ strokeDashoffset: 0 }}
            animate={{ strokeDashoffset: -16 }}
            transition={{
              duration: 0.4,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </svg>
      )}
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

      </div>
    </div>
  );
};

export { GroupHeader };
