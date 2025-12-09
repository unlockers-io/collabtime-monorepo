"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { TeamMember } from "@/types";
import { removeMember, updateMember } from "@/lib/actions";
import {
  COMMON_TIMEZONES,
  formatTimezoneLabel,
  isCurrentlyWorking,
} from "@/lib/timezones";
import { formatHour } from "@/lib/utils";

type MemberCardProps = {
  member: TeamMember;
  teamId: string;
  onMemberRemoved: () => void;
  onMemberUpdated: () => void;
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
        toast.success("Member removed");
        onMemberRemoved();
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
        onMemberUpdated();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleCancel = () => {
    setName(member.name);
    setTitle(member.title);
    setTimezone(member.timezone);
    setWorkingHoursStart(member.workingHoursStart);
    setWorkingHoursEnd(member.workingHoursEnd);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="h-9 appearance-none rounded-md border border-neutral-300 bg-white bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23737373%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-size-[16px_16px] bg-position-[right_12px_center] bg-no-repeat pl-3 pr-10 font-mono text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {formatTimezoneLabel(tz, true)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Work Starts
            </label>
            <select
              value={workingHoursStart}
              onChange={(e) => setWorkingHoursStart(Number(e.target.value))}
              className="h-9 appearance-none rounded-md border border-neutral-300 bg-white bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23737373%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-size-[16px_16px] bg-position-[right_12px_center] bg-no-repeat pl-3 pr-10 font-mono text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {formatHour(hour)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Work Ends
            </label>
            <select
              value={workingHoursEnd}
              onChange={(e) => setWorkingHoursEnd(Number(e.target.value))}
              className="h-9 appearance-none rounded-md border border-neutral-300 bg-white bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23737373%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-size-[16px_16px] bg-position-[right_12px_center] bg-no-repeat pl-3 pr-10 font-mono text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {formatHour(hour)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="h-8 rounded-md border border-neutral-300 px-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !name.trim()}
            className="h-8 rounded-md bg-neutral-900 px-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {isAvailable && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
            </span>
          )}
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
            {member.name}
          </span>
          {member.title && (
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {member.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <span className="font-mono">{formatTimezoneLabel(member.timezone)}</span>
          <span className="text-neutral-300 dark:text-neutral-600">|</span>
          <span className="font-mono">
            {formatHour(member.workingHoursStart)} -{" "}
            {formatHour(member.workingHoursEnd)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setIsEditing(true)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
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
          className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          aria-label={`Remove ${member.name}`}
        >
          {isPending ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
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
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export { MemberCard };
