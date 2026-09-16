"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { cn } from "@repo/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { teamQueryKeys } from "@/hooks/use-team-query";
import { removeGroup, updateGroup } from "@/lib/actions/group-actions";
import type { TeamGroup } from "@/types";

type GroupCardProps = {
  canEdit: boolean;
  group: TeamGroup;
  isDropTarget?: boolean;
  memberCount: number;
  teamId: string;
};

const GroupCard = ({
  canEdit,
  group,
  isDropTarget = false,
  memberCount,
  teamId,
}: GroupCardProps) => {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState("");

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
        void queryClient.invalidateQueries({ queryKey: teamQueryKeys.team(teamId) });
        toast.success(`Group "${group.name}" removed`);
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
      className="group/name flex items-center gap-1.5 text-left"
      onClick={handleStartEditing}
      type="button"
    >
      <span className="font-semibold text-foreground">{group.name}</span>
      <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100 group-focus-visible/name:opacity-100" />
    </button>
  ) : (
    <div className="flex items-center gap-1.5 text-left">
      <span className="font-semibold text-foreground">{group.name}</span>
    </div>
  );

  return (
    <div
      className={cn(
        "group relative isolate flex flex-col gap-3 py-4 text-sm before:absolute before:-inset-x-4 before:inset-y-0 before:-z-10 before:rounded-lg before:bg-transparent before:transition-colors focus-within:before:bg-muted/30 hover:before:bg-muted/30",
        isDropTarget && "outline-2 -outline-offset-1 outline-foreground",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex size-10 items-center justify-center border border-border bg-secondary text-secondary-foreground">
          <Users className="size-5" />
        </div>

        {canEdit && (
          <Button
            aria-label={`Remove group ${group.name}`}
            className="shrink-0"
            disabled={isPending}
            onClick={handleRemove}
            size="icon-sm"
            type="button"
            variant="destructive"
          >
            {isPending ? <Spinner /> : <Trash2 className="size-4" />}
          </Button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {canEdit && isEditing ? editInput : groupName}

        <div className="mt-auto">
          <Badge variant="secondary">
            <Users className="size-3" />
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </Badge>
        </div>
      </div>
    </div>
  );
};

export { GroupCard };
