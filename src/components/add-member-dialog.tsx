"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { GroupSelector } from "@/components/group-selector";

type AddMemberDialogProps = {
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

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  title: z.string().optional(),
  timezone: z.string(),
  workingHoursStart: z.number().min(0).max(23),
  workingHoursEnd: z.number().min(0).max(23),
});

type FormValues = z.infer<typeof formSchema>;

type AddMemberFormProps = {
  teamId: string;
  groups: TeamGroup[];
  isFirstMember: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberAdded: (member: TeamMember) => void;
};

const AddMemberForm = ({
  teamId,
  groups,
  isFirstMember,
  onOpenChange,
  onMemberAdded,
}: AddMemberFormProps) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(
    undefined
  );
  const [titlePlaceholder] = useState(getRandomPlaceholder);
  const defaultTimezone = getUserTimezone();

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

  const { handleSubmit, control, formState } = form;

  const onSubmit = async (data: FormValues) => {
    const result = await addMember(teamId, {
      ...data,
      title: data.title ?? "",
      groupId: selectedGroupId,
    });

    if (result.success) {
      onOpenChange(false);
      onMemberAdded(result.data.member);
      toast.success(`${data.name} added to team`);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3 text-neutral-900 dark:text-neutral-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 dark:bg-neutral-100">
            <UserPlus className="h-5 w-5 text-white dark:text-neutral-900" />
          </div>
          Add Team Member
        </DialogTitle>
        <DialogDescription>
          {isFirstMember
            ? "Start by adding your own details."
            : "Add a new member to your team."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="member-name">Name *</Label>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <Input
                {...field}
                id="member-name"
                placeholder="John Doe"
                aria-invalid={formState.errors.name ? "true" : "false"}
              />
            )}
          />
          {formState.errors.name && (
            <p className="text-xs text-red-500">
              {formState.errors.name.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="member-title">Title (optional)</Label>
          <Controller
            control={control}
            name="title"
            render={({ field }) => (
              <Input
                {...field}
                id="member-title"
                placeholder={titlePlaceholder}
              />
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="member-timezone">Timezone</Label>
          <Controller
            control={control}
            name="timezone"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="member-timezone">
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="member-group">Group (optional)</Label>
            <GroupSelector
              id="member-group"
              groups={groups}
              value={selectedGroupId}
              onValueChange={setSelectedGroupId}
              placeholder="No group"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="member-work-start">Work Starts</Label>
            <Controller
              control={control}
              name="workingHoursStart"
              render={({ field }) => (
                <Select
                  value={String(field.value)}
                  onValueChange={(value) => field.onChange(Number(value))}
                >
                  <SelectTrigger id="member-work-start">
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="member-work-end">Work Ends</Label>
            <Controller
              control={control}
              name="workingHoursEnd"
              render={({ field }) => (
                <Select
                  value={String(field.value)}
                  onValueChange={(value) => field.onChange(Number(value))}
                >
                  <SelectTrigger id="member-work-end">
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
      </div>

      <DialogFooter>
        {!isFirstMember && (
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={formState.isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={formState.isSubmitting || !formState.isValid}
        >
          {formState.isSubmitting ? (
            <>
              <Spinner className="mr-2" />
              Adding…
            </>
          ) : (
            "Add Member"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
};

const AddMemberDialog = ({
  teamId,
  groups,
  onMemberAdded,
  isFirstMember,
}: AddMemberDialogProps) => {
  // Initialize open state based on isFirstMember prop
  const [open, setOpen] = useState(isFirstMember);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          type="button"
          className="group flex h-14 w-full items-center justify-center gap-2 border-2 border-dashed border-neutral-200 bg-neutral-50/50 text-neutral-600 hover:border-neutral-400 hover:bg-neutral-100/50 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/50"
        >
          <UserPlus className="h-5 w-5 transition-transform group-hover:scale-110" />
          <span className="font-medium">Add Team Member</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-white dark:bg-neutral-900">
        {open && (
          <AddMemberForm
            teamId={teamId}
            groups={groups}
            isFirstMember={isFirstMember}
            onOpenChange={setOpen}
            onMemberAdded={onMemberAdded}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export { AddMemberDialog };
