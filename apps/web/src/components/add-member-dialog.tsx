"use client";

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
import { useForm } from "@tanstack/react-form";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { GroupSelector } from "@/components/group-selector";
import { inviteMember } from "@/lib/actions/invitation-actions";
import { addMember } from "@/lib/actions/member-actions";
import { COMMON_TIMEZONES, formatTimezoneLabel, getUserTimezone } from "@/lib/timezones";
import { formatHour } from "@/lib/utils";
import type { TeamGroup, TeamMember } from "@/types";

type AddMemberDialogProps = {
  groups: Array<TeamGroup>;
  isFirstMember: boolean;
  onMemberAdded: (member: TeamMember) => void;
  teamId: string;
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
  email: z.string().email("Invalid email address").or(z.literal("")),
  title: z.string(),
  timezone: z.enum(COMMON_TIMEZONES, { message: "Invalid timezone" }),
  workingHoursStart: z.number().min(0).max(23),
  workingHoursEnd: z.number().min(0).max(23),
  groupId: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

type AddMemberFormProps = {
  groups: Array<TeamGroup>;
  isFirstMember: boolean;
  onMemberAdded: (member: TeamMember) => void;
  onOpenChange: (open: boolean) => void;
  teamId: string;
};

const AddMemberForm = ({
  teamId,
  groups,
  isFirstMember,
  onOpenChange,
  onMemberAdded,
}: AddMemberFormProps) => {
  const [titlePlaceholder] = useState(getRandomPlaceholder);
  const defaultTimezone = getUserTimezone() as FormValues["timezone"];

  const defaultValues: FormValues = {
    name: "",
    email: "",
    title: "",
    timezone: defaultTimezone,
    workingHoursStart: 9,
    workingHoursEnd: 17,
    groupId: "",
  };

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      const { email: emailValue, ...memberData } = value;
      const result = await addMember(teamId, {
        ...memberData,
        title: memberData.title || "",
        groupId: memberData.groupId || undefined,
      });

      if (result.success) {
        onOpenChange(false);
        onMemberAdded(result.data.member);
        toast.success(`${value.name} added to team`);

        if (emailValue) {
          const inviteResult = await inviteMember(teamId, result.data.member.id, emailValue);
          if (inviteResult.success) {
            if (inviteResult.data.emailSent) {
              toast.success(`Invitation sent to ${emailValue}`);
            } else {
              toast.success(`Invitation created for ${emailValue}`);
            }
          } else {
            toast.error(inviteResult.error);
          }
        }
      } else {
        toast.error(result.error);
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      noValidate
    >
      <DialogHeader>
        <DialogTitle className="gap-3 flex items-center">
          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary">
            <UserPlus className="h-5 w-5 text-primary-foreground" />
          </div>
          Add Team Member
        </DialogTitle>
        <DialogDescription>
          {isFirstMember ? "Start by adding your own details." : "Add a new member to your team."}
        </DialogDescription>
      </DialogHeader>

      <div className="gap-4 py-4 flex flex-col">
        <form.Field name="name">
          {(field) => (
            <Field data-invalid={!field.state.meta.isValid}>
              <FieldLabel htmlFor="member-name">Name *</FieldLabel>
              <Input
                id="member-name"
                placeholder="John Doe"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={!field.state.meta.isValid}
              />
              {!field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          )}
        </form.Field>

        <form.Field name="email">
          {(field) => (
            <Field data-invalid={!field.state.meta.isValid}>
              <FieldLabel htmlFor="member-email">Email (optional)</FieldLabel>
              <Input
                id="member-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="jane@example.com"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={!field.state.meta.isValid}
              />
              <p className="text-xs text-muted-foreground">
                Send an invitation to this email address.
              </p>
              {!field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          )}
        </form.Field>

        <form.Field name="title">
          {(field) => (
            <Field data-invalid={!field.state.meta.isValid}>
              <FieldLabel htmlFor="member-title">Title (optional)</FieldLabel>
              <Input
                id="member-title"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder={titlePlaceholder}
                aria-invalid={!field.state.meta.isValid}
              />
              {!field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          )}
        </form.Field>

        <form.Field name="timezone">
          {(field) => (
            <Field data-invalid={!field.state.meta.isValid}>
              <FieldLabel htmlFor="member-timezone">Timezone</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(value) => {
                  if (value === null) {
                    return;
                  }
                  field.handleChange(value as FormValues["timezone"]);
                  field.handleBlur();
                }}
              >
                <SelectTrigger id="member-timezone" aria-invalid={!field.state.meta.isValid}>
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
              {!field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          )}
        </form.Field>

        {groups.length > 0 && (
          <form.Field name="groupId">
            {(field) => (
              <Field data-invalid={!field.state.meta.isValid}>
                <FieldLabel htmlFor="member-group">Group (optional)</FieldLabel>
                <GroupSelector
                  id="member-group"
                  aria-invalid={!field.state.meta.isValid}
                  groups={groups}
                  value={field.state.value || undefined}
                  onValueChange={(value) => {
                    field.handleChange(value ?? "");
                    field.handleBlur();
                  }}
                  placeholder="No group"
                />
                {!field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )}
          </form.Field>
        )}

        <div className="gap-4 grid grid-cols-2">
          <form.Field name="workingHoursStart">
            {(field) => (
              <Field data-invalid={!field.state.meta.isValid}>
                <FieldLabel htmlFor="member-work-start">Work Starts</FieldLabel>
                <Select
                  value={String(field.state.value)}
                  onValueChange={(value) => {
                    if (value === null) {
                      return;
                    }
                    field.handleChange(Number(value));
                    field.handleBlur();
                  }}
                >
                  <SelectTrigger id="member-work-start" aria-invalid={!field.state.meta.isValid}>
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
                {!field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )}
          </form.Field>

          <form.Field name="workingHoursEnd">
            {(field) => (
              <Field data-invalid={!field.state.meta.isValid}>
                <FieldLabel htmlFor="member-work-end">Work Ends</FieldLabel>
                <Select
                  value={String(field.state.value)}
                  onValueChange={(value) => {
                    if (value === null) {
                      return;
                    }
                    field.handleChange(Number(value));
                    field.handleBlur();
                  }}
                >
                  <SelectTrigger id="member-work-end" aria-invalid={!field.state.meta.isValid}>
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
                {!field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )}
          </form.Field>
        </div>
      </div>

      <DialogFooter>
        {!isFirstMember && (
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={form.state.isSubmitting}
          >
            Cancel
          </Button>
        )}
        <form.Subscribe
          selector={(state) => ({
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button type="submit" disabled={isSubmitting || !canSubmit}>
              {isSubmitting ? (
                <span className="gap-2 flex items-center">
                  <Spinner />
                  Adding...
                </span>
              ) : (
                "Add Member"
              )}
            </Button>
          )}
        </form.Subscribe>
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
  const [open, setOpen] = useState(isFirstMember);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            type="button"
            className="group h-14 gap-2 flex w-full items-center justify-center border-2 border-dashed border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground hover:bg-muted"
          />
        }
      >
        <UserPlus className="h-5 w-5 transition-transform group-hover:scale-110" />
        <span className="font-medium">Add Team Member</span>
      </DialogTrigger>
      <DialogContent className="max-w-md">
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
