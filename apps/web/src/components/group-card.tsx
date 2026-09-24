"use client";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { cn } from "@repo/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmRemoveDialog } from "@/components/confirm-remove-dialog";
import { teamQueryKeys } from "@/hooks/use-team-query";
import { removeGroup, updateGroup } from "@/lib/actions/group-actions";
import type { TeamGroup } from "@/types";

type GroupCardProps = {
  canEdit: boolean;
  /** Rendered first; the only element that starts a drag. */
  dragHandle?: ReactNode;
  group: TeamGroup;
  isDropTarget?: boolean;
  memberCount: number;
  teamId: string;
};

const GroupCard = ({
  canEdit,
  dragHandle,
  group,
  isDropTarget = false,
  memberCount,
  teamId,
}: GroupCardProps) => {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);

  const handleStartEditing = () => {
    setEditingName(group.name);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!canEdit) {
      return;
    }
    const trimmedName = editingName.trim();
    if (!trimmedName || trimmedName === group.name) {
      setIsEditing(false);
      return;
    }

    setIsEditing(false);
    startTransition(async () => {
      const result = await updateGroup(teamId, group.id, {
        name: trimmedName,
      });
      if (result.success) {
        void queryClient.invalidateQueries({ queryKey: teamQueryKeys.team(teamId) });
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  const handleRemove = () => {
    if (!canEdit) {
      return;
    }
    startTransition(async () => {
      const result = await removeGroup(teamId, group.id);
      if (result.success) {
        setIsRemoveOpen(false);
        void queryClient.invalidateQueries({ queryKey: teamQueryKeys.team(teamId) });
        toast.success(`${group.name} removed`);
      } else {
        toast.error(result.error);
      }
    });
  };

  const editInput = (
    <Input
      aria-label={`Rename ${group.name}`}
      autoFocus
      onBlur={handleSave}
      onChange={(e) => {
        setEditingName(e.target.value);
      }}
      onFocus={(e) => {
        e.currentTarget.select();
      }}
      onKeyDown={handleKeyDown}
      type="text"
      value={editingName}
    />
  );

  const groupName = canEdit ? (
    <button
      aria-label={`Rename ${group.name}`}
      className="group/name flex min-w-0 items-center gap-1.5 rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      onClick={handleStartEditing}
      type="button"
    >
      <span className="truncate font-medium text-foreground">{group.name}</span>
      <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100 group-focus-visible/name:opacity-100" />
    </button>
  ) : (
    <span className="truncate font-medium text-foreground">{group.name}</span>
  );

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 py-2.5 text-sm sm:gap-3",
          isDropTarget && "outline-2 -outline-offset-1 outline-foreground",
        )}
      >
        {dragHandle}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {canEdit && isEditing ? editInput : groupName}
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </span>
        </div>

        {canEdit && (
          <Button
            aria-label={`Remove group ${group.name}`}
            className="shrink-0"
            disabled={isPending}
            onClick={() => {
              setIsRemoveOpen(true);
            }}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {canEdit && (
        <ConfirmRemoveDialog
          confirmLabel="Remove group"
          description={
            memberCount === 0
              ? "The group is empty, so nobody is affected."
              : `Its ${memberCount} ${memberCount === 1 ? "member stays" : "members stay"} in the workspace, ungrouped.`
          }
          isPending={isPending}
          onConfirm={handleRemove}
          onOpenChange={setIsRemoveOpen}
          open={isRemoveOpen}
          title={`Remove the ${group.name} group?`}
        />
      )}
    </>
  );
};

export { GroupCard };
