"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import { addMember } from "@/lib/actions";
import type { TeamGroup, TeamMember } from "@/types";
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
import { Spinner } from "@/components/ui/spinner";
import { GroupSelector } from "@/components/group-selector";

type AddMemberFormProps = {
  teamId: string;
  groups: TeamGroup[];
  onMemberAdded: (member: TeamMember) => void;
  isFirstMember: boolean;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const TITLE_PLACEHOLDERS = [
  "Software Engineer",
  "Product Manager",
  "Designer",
  "Marketing Manager",
  "CEO",
  "CTO",
  "Business Analyst",
  "Data Scientist",
  "DevOps Engineer",
  "QA Engineer",
  "Sales Representative",
  "Customer Success",
  "HR Manager",
  "Finance Manager",
  "Operations Manager",
];

const getRandomPlaceholder = () =>
  TITLE_PLACEHOLDERS[Math.floor(Math.random() * TITLE_PLACEHOLDERS.length)];

const AddMemberForm = ({
  teamId,
  groups,
  onMemberAdded,
  isFirstMember,
}: AddMemberFormProps) => {
  // Track user interaction with the form. Once a user opens or closes the form,
  // that decision takes precedence over the isFirstMember prop. This prevents
  // the form from closing due to realtime updates while the user is typing.
  const [userIntent, setUserIntent] = useState<"open" | "closed" | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(undefined);
  const [titlePlaceholder] = useState(getRandomPlaceholder);
  const defaultTimezone = getUserTimezone();

  // Form is open if:
  // 1. User explicitly opened it (userIntent === "open"), OR
  // 2. No user interaction yet AND isFirstMember is true
  const isOpen = userIntent === "open" || (userIntent === null && isFirstMember);

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

  const onSubmit = async (data: FormValues) => {
    const result = await addMember(teamId, {
      ...data,
      title: data.title ?? "",
      groupId: selectedGroupId,
    });

    if (result.success) {
      reset({
        name: "",
        title: "",
        timezone: getUserTimezone(),
        workingHoursStart: 9,
        workingHoursEnd: 17,
      });
      setSelectedGroupId(undefined);
      setUserIntent(null); // Reset to allow isFirstMember prop to take over
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
        onClick={() => setUserIntent("open")}
      >
        <UserPlus className="h-5 w-5 transition-transform group-hover:scale-110" />
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
              <UserPlus className="h-5 w-5 text-white dark:text-neutral-900" />
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
              size="icon"
              onClick={() => setUserIntent("closed")}
              aria-label="Close form"
              className="h-10 w-10 shrink-0 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            >
              <X className="h-5 w-5" />
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
                <Input {...field} id="title" placeholder={titlePlaceholder} />
              )}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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

          {groups.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="group">Group (optional)</Label>
              <GroupSelector
                id="group"
                groups={groups}
                value={selectedGroupId}
                onValueChange={setSelectedGroupId}
                placeholder="No group"
              />
            </div>
          )}
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
                <Spinner />
                Adding...
              </>
            ) : (
              <>
                <UserPlus className="h-5 w-5" />
                Add Member
              </>
            )}
          </Button>
          {!isFirstMember && (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setUserIntent("closed")}
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
