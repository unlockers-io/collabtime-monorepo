"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { TeamMember } from "@/types";
import { removeMember, updateMember } from "@/lib/actions";
import {
  COMMON_TIMEZONES,
  formatTimezoneLabel,
  isCurrentlyWorking,
} from "@/lib/timezones";
import { formatHour } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MemberCardProps = {
  member: TeamMember;
  teamId: string;
  onMemberRemoved: (memberId: string) => void;
  onMemberUpdated: (member: TeamMember) => void;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const MemberCard = ({
  member,
  teamId,
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

  // Sync local form state when member prop updates (e.g., via realtime)
  useEffect(() => {
    setName(member.name);
    setTitle(member.title);
    setTimezone(member.timezone);
    setWorkingHoursStart(member.workingHoursStart);
    setWorkingHoursEnd(member.workingHoursEnd);
  }, [member]);

  const handleCancel = useCallback(() => {
    setName(member.name);
    setTitle(member.title);
    setTimezone(member.timezone);
    setWorkingHoursStart(member.workingHoursStart);
    setWorkingHoursEnd(member.workingHoursEnd);
    setIsEditing(false);
  }, [member.name, member.title, member.timezone, member.workingHoursStart, member.workingHoursEnd]);

  // Close edit form on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isEditing) {
        handleCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isEditing, handleCancel]);

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
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            aria-label="Cancel editing"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
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

  return (
    <div className="group flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700">
      <div className="flex items-start gap-3">
        {/* Avatar with status */}
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
            {member.name.charAt(0).toUpperCase()}
          </div>
          {isAvailable && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-green-500 dark:border-neutral-900">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-50" />
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              {member.name}
            </span>
            {member.title && (
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                {member.title}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
            <span>{formatTimezoneLabel(member.timezone)}</span>
            <span className="hidden text-neutral-300 dark:text-neutral-600 sm:inline">
              &middot;
            </span>
            <span>
              {formatHour(member.workingHoursStart)} –{" "}
              {formatHour(member.workingHoursEnd)}
            </span>
            {isAvailable && (
              <span className="font-medium text-green-600 dark:text-green-400">
                Available now
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setIsEditing(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            aria-label={`Edit ${member.name}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>
          <button
            onClick={handleRemove}
            disabled={isPending}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            aria-label={`Remove ${member.name}`}
          >
            {isPending ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-600 dark:border-t-neutral-300" />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" x2="10" y1="11" y2="17" />
                <line x1="14" x2="14" y1="11" y2="17" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export { MemberCard };
