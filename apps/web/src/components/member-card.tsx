"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { TeamGroup, TeamMember } from "@/types";
import { removeMember } from "@/lib/actions";
import {
  Button,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui";
import {
  formatTimezoneLabel,
  isCurrentlyWorking,
  getMinutesUntilAvailable,
  formatTimeUntilAvailable,
} from "@/lib/timezones";
import { Badge } from "@repo/ui";
import { cn, formatHour } from "@/lib/utils";
import { useDrag } from "@/contexts/drag-context";
import { EditMemberDialog } from "@/components/edit-member-dialog";

type MemberCardProps = {
  member: TeamMember;
  teamId: string;
  token: string | null;
  groups: TeamGroup[];
  canEdit: boolean;
  onMemberRemoved: (memberId: string) => void;
  onMemberUpdated: (member: TeamMember) => void;
};

const MemberCard = ({
  member,
  teamId,
  token,
  groups,
  canEdit,
  onMemberRemoved,
  onMemberUpdated,
}: MemberCardProps) => {
  const [isPending, startTransition] = useTransition();
  const [isAvailable, setIsAvailable] = useState(false);
  const [minutesUntilAvailable, setMinutesUntilAvailable] = useState(0);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const { isDragging, startDrag, endDrag } = useDrag();

  // Detect touch device to disable dragging on mobile
  useEffect(() => {
    const checkTouchDevice = () => {
      setIsTouchDevice(
        "ontouchstart" in window ||
          navigator.maxTouchPoints > 0 ||
          window.matchMedia("(pointer: coarse)").matches,
      );
    };
    checkTouchDevice();
    // Re-check on resize in case of device mode changes in dev tools
    window.addEventListener("resize", checkTouchDevice);
    return () => window.removeEventListener("resize", checkTouchDevice);
  }, []);

  useEffect(() => {
    const checkAvailability = () => {
      const available = isCurrentlyWorking(
        member.timezone,
        member.workingHoursStart,
        member.workingHoursEnd,
      );
      setIsAvailable(available);

      if (!available) {
        setMinutesUntilAvailable(
          getMinutesUntilAvailable(
            member.timezone,
            member.workingHoursStart,
            member.workingHoursEnd,
          ),
        );
      } else {
        setMinutesUntilAvailable(0);
      }
    };

    checkAvailability();
    const interval = setInterval(checkAvailability, 60000);
    return () => clearInterval(interval);
  }, [member.timezone, member.workingHoursStart, member.workingHoursEnd]);

  const handleRemove = () => {
    if (!canEdit || !token) return;
    startTransition(async () => {
      const result = await removeMember(teamId, token, member.id);
      if (result.success) {
        onMemberRemoved(member.id);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", member.id);
    e.dataTransfer.effectAllowed = "move";
    startDrag(member.groupId);
  };

  const handleDragEnd = () => {
    endDrag();
  };

  const isDraggable = canEdit && !isTouchDevice;

  return (
    <>
      <div
        className={cn(
          "group flex h-full min-h-45 flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-input hover:shadow-md",
          isDraggable && (isDragging ? "cursor-grabbing" : "cursor-grab"),
        )}
        draggable={isDraggable}
        onDragStart={isDraggable ? handleDragStart : undefined}
        onDragEnd={isDraggable ? handleDragEnd : undefined}
      >
        {/* Top row: Avatar and Actions */}
        <div className="flex items-start justify-between">
          {/* Avatar with status */}
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
              {member.name.charAt(0).toUpperCase()}
            </div>
            {isAvailable && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-green-500">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-50" />
              </span>
            )}
          </div>

          {/* Actions */}
          {canEdit && (
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsEditDialogOpen(true)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Edit ${member.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleRemove}
                disabled={isPending}
                className="text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                aria-label={`Remove ${member.name}`}
              >
                {isPending ? <Spinner /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>

        {/* Info - stacked vertically */}
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-foreground">
              {member.name}
            </span>
            {member.title && (
              <span className="text-sm text-muted-foreground">
                {member.title}
              </span>
            )}
          </div>

          {/* Timezone and hours */}
          <div className="mt-auto flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="truncate">
              {formatTimezoneLabel(member.timezone)}
            </span>
            <span>
              {formatHour(member.workingHoursStart)} –{" "}
              {formatHour(member.workingHoursEnd)}
            </span>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-1.5">
            {isAvailable ? (
              <Badge className="border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Available
              </Badge>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Badge className="cursor-help border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Not Available
                      </Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Available{" "}
                      {formatTimeUntilAvailable(minutesUntilAvailable)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {member.groupId && groups.find((g) => g.id === member.groupId) && (
              <Badge
                variant="secondary"
                className="border-transparent"
              >
                {groups.find((g) => g.id === member.groupId)?.name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {canEdit && token && (
        <EditMemberDialog
          member={member}
          teamId={teamId}
          token={token}
          groups={groups}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onMemberUpdated={onMemberUpdated}
        />
      )}
    </>
  );
};

export { MemberCard };
