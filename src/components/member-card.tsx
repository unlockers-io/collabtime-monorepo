"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, X } from "lucide-react";
import type { TeamGroup, TeamMember } from "@/types";
import { removeMember, updateMember } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { GroupSelector } from "@/components/group-selector";
import {
  COMMON_TIMEZONES,
  formatTimezoneLabel,
  isCurrentlyWorking,
} from "@/lib/timezones";
import { cn, formatHour } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useDrag } from "@/contexts/drag-context";

type MemberCardProps = {
  member: TeamMember;
  teamId: string;
  groups: TeamGroup[];
  onMemberRemoved: (memberId: string) => void;
  onMemberUpdated: (member: TeamMember) => void;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const MemberCard = ({
  member,
  teamId,
  groups,
  onMemberRemoved,
  onMemberUpdated,
}: MemberCardProps) => {
  const [isPending, startTransition] = useTransition();
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [title, setTitle] = useState(member.title);
  const [timezone, setTimezone] = useState(member.timezone);
  const [workingHoursStart, setWorkingHoursStart] = useState(
    member.workingHoursStart
  );
  const [workingHoursEnd, setWorkingHoursEnd] = useState(member.workingHoursEnd);
  const [groupId, setGroupId] = useState<string | undefined>(member.groupId);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const { startDrag, endDrag } = useDrag();

  // Detect touch device to disable dragging on mobile
  useEffect(() => {
    const checkTouchDevice = () => {
      setIsTouchDevice(
        "ontouchstart" in window ||
          navigator.maxTouchPoints > 0 ||
          window.matchMedia("(pointer: coarse)").matches
      );
    };
    checkTouchDevice();
    // Re-check on resize in case of device mode changes in dev tools
    window.addEventListener("resize", checkTouchDevice);
    return () => window.removeEventListener("resize", checkTouchDevice);
  }, []);

  // Sync local form state when member prop updates (e.g., via realtime)
  useEffect(() => {
    setName(member.name);
    setTitle(member.title);
    setTimezone(member.timezone);
    setWorkingHoursStart(member.workingHoursStart);
    setWorkingHoursEnd(member.workingHoursEnd);
    setGroupId(member.groupId);
  }, [member]);

  const handleCancel = useCallback(() => {
    setName(member.name);
    setTitle(member.title);
    setTimezone(member.timezone);
    setWorkingHoursStart(member.workingHoursStart);
    setWorkingHoursEnd(member.workingHoursEnd);
    setGroupId(member.groupId);
    setIsEditing(false);
  }, [member.name, member.title, member.timezone, member.workingHoursStart, member.workingHoursEnd, member.groupId]);

  useEffect(() => {
    const checkAvailability = () => {
      setIsAvailable(
        isCurrentlyWorking(
          member.timezone,
          member.workingHoursStart,
          member.workingHoursEnd
        )
      );
    };

    checkAvailability();
    const interval = setInterval(checkAvailability, 60000);
    return () => clearInterval(interval);
  }, [member.timezone, member.workingHoursStart, member.workingHoursEnd]);

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeMember(teamId, member.id);
      if (result.success) {
        onMemberRemoved(member.id);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;

    startTransition(async () => {
      const result = await updateMember(teamId, member.id, {
        name: name.trim(),
        title: title.trim(),
        timezone,
        workingHoursStart,
        workingHoursEnd,
        groupId,
      });
      if (result.success) {
        toast.success("Member updated");
        setIsEditing(false);
        onMemberUpdated({
          ...member,
          name: name.trim(),
          title: title.trim(),
          timezone,
          workingHoursStart,
          workingHoursEnd,
          groupId,
        });
      } else {
        toast.error(result.error);
      }
    });
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Edit Member
          </h3>
          <button
            type="button"
            onClick={handleCancel}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            aria-label="Cancel editing"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 transition-colors placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-100 dark:focus:ring-neutral-100/10"
              placeholder="John Doe"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 transition-colors placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-100 dark:focus:ring-neutral-100/10"
              placeholder="Software Engineer"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Timezone
            </label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {formatTimezoneLabel(tz, true)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {groups.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Group
              </label>
              <GroupSelector
                groups={groups}
                value={groupId}
                onValueChange={setGroupId}
                placeholder="No group"
              />
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Work Starts
            </label>
            <Select
              value={String(workingHoursStart)}
              onValueChange={(value) => setWorkingHoursStart(Number(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((hour) => (
                  <SelectItem key={hour} value={String(hour)}>
                    {formatHour(hour)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Work Ends
            </label>
            <Select
              value={String(workingHoursEnd)}
              onValueChange={(value) => setWorkingHoursEnd(Number(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((hour) => (
                  <SelectItem key={hour} value={String(hour)}>
                    {formatHour(hour)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="h-10 rounded-lg border border-neutral-200 px-4 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !name.trim()}
            className="h-10 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition-all hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", member.id);
    e.dataTransfer.effectAllowed = "move";
    startDrag();
  };

  const handleDragEnd = () => {
    endDrag();
  };

  const isDraggable = !isTouchDevice;

  return (
    <div
      className={cn(
        "group flex h-full min-h-[180px] flex-col rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700",
        isDraggable && "cursor-grab active:cursor-grabbing"
      )}
      draggable={isDraggable}
      onDragStart={isDraggable ? handleDragStart : undefined}
      onDragEnd={isDraggable ? handleDragEnd : undefined}
    >
      {/* Top row: Avatar and Actions */}
      <div className="flex items-start justify-between">
        {/* Avatar with status */}
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-base font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
            {member.name.charAt(0).toUpperCase()}
          </div>
          {isAvailable && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-green-500 dark:border-neutral-900">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-50" />
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsEditing(true)}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            aria-label={`Edit ${member.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleRemove}
            disabled={isPending}
            className="text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            aria-label={`Remove ${member.name}`}
          >
            {isPending ? <Spinner /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Info - stacked vertically */}
      <div className="mt-3 flex flex-1 flex-col gap-1.5">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
            {member.name}
          </span>
          {member.title && (
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {member.title}
            </span>
          )}
        </div>

        {/* Timezone and hours */}
        <div className="mt-auto flex flex-col gap-1 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="truncate">{formatTimezoneLabel(member.timezone)}</span>
          <span>
            {formatHour(member.workingHoursStart)} – {formatHour(member.workingHoursEnd)}
          </span>
        </div>

        {/* Status badges */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {isAvailable && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Available
            </span>
          )}
          {member.groupId && groups.find((g) => g.id === member.groupId) && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              {groups.find((g) => g.id === member.groupId)?.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export { MemberCard };
