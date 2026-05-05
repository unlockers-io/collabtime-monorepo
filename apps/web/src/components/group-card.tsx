"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { cn } from "@repo/ui/lib/utils";
import { Pencil, Trash2, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { removeGroup, updateGroup } from "@/lib/actions/group-actions";
import type { TeamGroup } from "@/types";

type GroupCardProps = {
  canEdit: boolean;
  group: TeamGroup;
  isDropTarget?: boolean;
  memberCount: number;
  onGroupRemoved: (groupId: string) => void;
  onGroupUpdated: (group: TeamGroup) => void;
  teamId: string;
};

const GroupCard = ({
  canEdit,
  group,
  isDropTarget = false,
  memberCount,
  onGroupRemoved,
  onGroupUpdated,
  teamId,
}: GroupCardProps) => {
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
        onGroupUpdated({ ...group, name: trimmedName });
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
        onGroupRemoved(group.id);
        toast.success(`Group "${group.name}" removed`);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Card
      className={cn(
        "group h-full gap-3 p-4 transition-shadow hover:shadow-md",
        isDropTarget && "outline-2 -outline-offset-1 outline-foreground",
      )}
    >
      {/* Top row: Icon and Actions */}
      <div className="flex items-start justify-between">
        <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Users className="size-5" />
        </div>

        {canEdit && (
          <Button
            aria-label={`Remove group ${group.name}`}
            className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
            disabled={isPending}
            onClick={handleRemove}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            {isPending ? <Spinner /> : <Trash2 className="size-4" />}
          </Button>
        )}
      </div>

      {/* Group info - stacked vertically */}
      <div className="flex flex-1 flex-col gap-2">
        {(() => {
          if (canEdit && isEditing) {
            return (
              <Input
                autoFocus
                className="h-9 text-sm font-medium"
                onBlur={handleSave}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={handleKeyDown}
                type="text"
                value={editingName}
              />
            );
          }
          if (canEdit) {
            return (
              <button
                className="group/name flex items-center gap-1.5 text-left"
                onClick={handleStartEditing}
                type="button"
              >
                <span className="font-semibold text-foreground">{group.name}</span>
                <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100" />
              </button>
            );
          }
          return (
            <div className="flex items-center gap-1.5 text-left">
              <span className="font-semibold text-foreground">{group.name}</span>
            </div>
          );
        })()}

        {/* Member count badge */}
        <div className="mt-auto">
          <Badge variant="secondary">
            <Users className="size-3" />
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </Badge>
        </div>
      </div>
    </Card>
  );
};

export { GroupCard };
