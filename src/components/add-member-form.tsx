"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { addMember } from "@/lib/actions";
import type { TeamMember } from "@/types";
import {
  COMMON_TIMEZONES,
  formatTimezoneLabel,
  getUserTimezone,
} from "@/lib/timezones";
import { formatHour } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

type AddMemberFormProps = {
  teamId: string;
  onMemberAdded: (member: TeamMember) => void;
  isFirstMember: boolean;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const AddMemberForm = ({
  teamId,
  onMemberAdded,
  isFirstMember,
}: AddMemberFormProps) => {
  const [isOpen, setIsOpen] = useState(isFirstMember);
  const defaultTimezone = getUserTimezone();

  const formSchema = z.object({
    name: z.string().min(1, "Name is required"),
    title: z.string().optional(),
    timezone: z.string(),
    workingHoursStart: z.number().min(0).max(23),
    workingHoursEnd: z.number().min(0).max(23),
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      title: "",
      timezone: defaultTimezone,
      workingHoursStart: 9,
      workingHoursEnd: 17,
    },
  });

  const { handleSubmit, control, reset, formState } = form;

  // Close form on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isFirstMember) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isFirstMember]);

  const onSubmit = async (data: FormValues) => {
    const result = await addMember(teamId, {
      ...data,
      title: data.title ?? "",
    });

    if (result.success) {
      reset({
        name: "",
        title: "",
        timezone: getUserTimezone(),
        workingHoursStart: 9,
        workingHoursEnd: 17,
      });
      setIsOpen(false);
      onMemberAdded(result.data.member);
    } else {
      toast.error(result.error);
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        type="button"
        className="group flex h-14 w-full items-center justify-center gap-2 border-2 border-dashed border-neutral-200 bg-neutral-50/50 text-neutral-600 hover:border-neutral-400 hover:bg-neutral-100/50 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/50"
        onClick={() => setIsOpen(true)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform group-hover:scale-110"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" x2="19" y1="8" y2="14" />
          <line x1="22" x2="16" y1="11" y2="11" />
        </svg>
        <span className="font-medium">Add Team Member</span>
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Card className="flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 dark:bg-neutral-100">
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
                className="text-white dark:text-neutral-900"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" x2="19" y1="8" y2="14" />
                <line x1="22" x2="16" y1="11" y2="11" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                Add Team Member
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {isFirstMember
                  ? "Start by adding your own details"
                  : "Add a new member to your team"}
              </p>
            </div>
          </div>
          {!isFirstMember && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              aria-label="Close form"
              className="h-8 w-8 rounded-lg p-0 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
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
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name *</Label>
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Input
                  {...field}
                  id="name"
                  aria-invalid={formState.errors.name ? "true" : "false"}
                  placeholder="John Doe"
                />
              )}
            />
            {formState.errors.name && (
              <p className="text-xs text-red-500">
                {formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title (optional)</Label>
            <Controller
              control={control}
              name="title"
              render={({ field }) => (
                <Input {...field} id="title" placeholder="Software Engineer" />
              )}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <Controller
            control={control}
            name="timezone"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="timezone">
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
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="workStart">Work Starts</Label>
            <Controller
              control={control}
              name="workingHoursStart"
              render={({ field }) => (
                <Select
                  value={String(field.value)}
                  onValueChange={(value) => field.onChange(Number(value))}
                >
                  <SelectTrigger id="workStart">
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
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="workEnd">Work Ends</Label>
            <Controller
              control={control}
              name="workingHoursEnd"
              render={({ field }) => (
                <Select
                  value={String(field.value)}
                  onValueChange={(value) => field.onChange(Number(value))}
                >
                  <SelectTrigger id="workEnd">
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
              )}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <Button
            type="submit"
            disabled={formState.isSubmitting || !formState.isValid}
            className="h-11 flex-1"
          >
            {formState.isSubmitting ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Adding...
              </>
            ) : (
              <>
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
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" x2="19" y1="8" y2="14" />
                  <line x1="22" x2="16" y1="11" y2="11" />
                </svg>
                Add Member
              </>
            )}
          </Button>
          {!isFirstMember && (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
          )}
        </div>
      </Card>
    </form>
  );
};

export { AddMemberForm };
