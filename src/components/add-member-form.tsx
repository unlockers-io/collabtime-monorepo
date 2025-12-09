"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addMember } from "@/lib/actions";
import {
  COMMON_TIMEZONES,
  formatTimezoneLabel,
  getUserTimezone,
} from "@/lib/timezones";
import { formatHour } from "@/lib/utils";

type AddMemberFormProps = {
  teamId: string;
  onMemberAdded: () => void;
  isFirstMember: boolean;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const AddMemberForm = ({
  teamId,
  onMemberAdded,
  isFirstMember,
}: AddMemberFormProps) => {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [timezone, setTimezone] = useState(getUserTimezone());
  const [workingHoursStart, setWorkingHoursStart] = useState(9);
  const [workingHoursEnd, setWorkingHoursEnd] = useState(17);
  const [isOpen, setIsOpen] = useState(isFirstMember);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      return;
    }

    startTransition(async () => {
      const result = await addMember(teamId, {
        name: name.trim(),
        title: title.trim(),
        timezone,
        workingHoursStart,
        workingHoursEnd,
      });

      if (result.success) {
        toast.success("Member added successfully");
        setName("");
        setTitle("");
        setTimezone(getUserTimezone());
        setWorkingHoursStart(9);
        setWorkingHoursEnd(17);
        setIsOpen(false);
        onMemberAdded();
      } else {
        toast.error(result.error);
      }
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-600 dark:border-neutral-700 dark:text-neutral-500 dark:hover:border-neutral-600 dark:hover:text-neutral-400"
      >
        <span className="text-xl">+</span>
        Add Team Member
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {isFirstMember ? "Add Yourself First" : "Add Team Member"}
      </h3>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="name"
          className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="John Doe"
          required
          className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="title"
          className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Title (optional)
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Software Engineer"
          className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="timezone"
          className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Timezone
        </label>
        <select
          id="timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="h-10 appearance-none rounded-md border border-neutral-300 bg-white bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23737373%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-size-[16px_16px] bg-position-[right_12px_center] bg-no-repeat pl-3 pr-10 font-mono text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        >
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {formatTimezoneLabel(tz, true)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="workStart"
            className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            Work Starts
          </label>
          <select
            id="workStart"
            value={workingHoursStart}
            onChange={(e) => setWorkingHoursStart(Number(e.target.value))}
            className="h-10 appearance-none rounded-md border border-neutral-300 bg-white bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23737373%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-size-[16px_16px] bg-position-[right_12px_center] bg-no-repeat pl-3 pr-10 font-mono text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {formatHour(hour)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="workEnd"
            className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            Work Ends
          </label>
          <select
            id="workEnd"
            value={workingHoursEnd}
            onChange={(e) => setWorkingHoursEnd(Number(e.target.value))}
            className="h-10 appearance-none rounded-md border border-neutral-300 bg-white bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23737373%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-size-[16px_16px] bg-position-[right_12px_center] bg-no-repeat pl-3 pr-10 font-mono text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {formatHour(hour)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="flex h-10 flex-1 items-center justify-center rounded-md bg-neutral-900 font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {isPending ? "Adding..." : "Add Member"}
        </button>
        {!isFirstMember && (
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex h-10 items-center justify-center rounded-md border border-neutral-300 px-4 font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export { AddMemberForm };
