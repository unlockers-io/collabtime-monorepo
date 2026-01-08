"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@repo/ui";
import { GroupSelector } from "@/components/group-selector";

type AddMemberDialogProps = {
  teamId: string;
  token: string;
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
  timezone: z.enum(COMMON_TIMEZONES, { message: "Invalid timezone" }),
  workingHoursStart: z.number().min(0).max(23),
  workingHoursEnd: z.number().min(0).max(23),
  groupId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type AddMemberFormProps = {
  teamId: string;
  token: string;
  groups: TeamGroup[];
  isFirstMember: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberAdded: (member: TeamMember) => void;
};

const AddMemberForm = ({
  teamId,
  token,
  groups,
  isFirstMember,
  onOpenChange,
  onMemberAdded,
}: AddMemberFormProps) => {
  const [titlePlaceholder] = useState(getRandomPlaceholder);
  const defaultTimezone = getUserTimezone() as FormValues["timezone"];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      title: "",
      timezone: defaultTimezone,
      workingHoursStart: 9,
      workingHoursEnd: 17,
      groupId: undefined,
    },
  });

  const { handleSubmit, formState } = form;

  const onSubmit = async (data: FormValues) => {
    const result = await addMember(teamId, token, {
      ...data,
      title: data.title ?? "",
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <UserPlus className="h-5 w-5 text-primary-foreground" />
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
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="member-name">Name *</FieldLabel>
              <Input
                {...field}
                id="member-name"
                placeholder="John Doe"
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="title"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="member-title">Title (optional)</FieldLabel>
              <Input
                {...field}
                id="member-title"
                value={field.value ?? ""}
                placeholder={titlePlaceholder}
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="timezone"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="member-timezone">Timezone</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="member-timezone"
                  aria-invalid={fieldState.invalid}
                >
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
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        {groups.length > 0 && (
          <Controller
            control={form.control}
            name="groupId"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="member-group">Group (optional)</FieldLabel>
                <GroupSelector
                  id="member-group"
                  aria-invalid={fieldState.invalid}
                  groups={groups}
                  value={field.value}
                  onValueChange={(value) => field.onChange(value)}
                  placeholder="No group"
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <Controller
            control={form.control}
            name="workingHoursStart"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="member-work-start">Work Starts</FieldLabel>
                <Select
                  value={String(field.value)}
                  onValueChange={(value) => field.onChange(Number(value))}
                >
                  <SelectTrigger
                    id="member-work-start"
                    aria-invalid={fieldState.invalid}
                  >
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
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="workingHoursEnd"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="member-work-end">Work Ends</FieldLabel>
                <Select
                  value={String(field.value)}
                  onValueChange={(value) => field.onChange(Number(value))}
                >
                  <SelectTrigger
                    id="member-work-end"
                    aria-invalid={fieldState.invalid}
                  >
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
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
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
            <span className="flex items-center gap-2">
              <Spinner />
              Adding…
            </span>
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
  token,
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
          className="group flex h-14 w-full items-center justify-center gap-2 border-2 border-dashed border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground hover:bg-muted"
        >
          <UserPlus className="h-5 w-5 transition-transform group-hover:scale-110" />
          <span className="font-medium">Add Team Member</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        {open && (
          <AddMemberForm
            teamId={teamId}
            token={token}
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
