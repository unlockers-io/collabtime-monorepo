"use client";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Spinner } from "@repo/ui/components/spinner";
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
  email: z.email("Invalid email address").or(z.literal("")),
  groupId: z.string(),
  name: z.string().min(1, "Name is required"),
  timezone: z.enum(COMMON_TIMEZONES, { message: "Invalid timezone" }),
  title: z.string(),
  workingHoursEnd: z.number().min(0).max(23),
  workingHoursStart: z.number().min(0).max(23),
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
  groups,
  isFirstMember,
  onMemberAdded,
  onOpenChange,
  teamId,
}: AddMemberFormProps) => {
  // useState lazy init so the placeholder is stable for this dialog instance;
  // setter is intentionally unused — the random placeholder must not change after mount
  const [titlePlaceholder, _setTitlePlaceholder] = useState(getRandomPlaceholder);
  const defaultTimezone = getUserTimezone() as FormValues["timezone"];

  const defaultValues: FormValues = {
    email: "",
    groupId: "",
    name: "",
    timezone: defaultTimezone,
    title: "",
    workingHoursEnd: 17,
    workingHoursStart: 9,
  };

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      const { email: emailValue, ...memberData } = value;
      const result = await addMember(teamId, {
        ...memberData,
        groupId: memberData.groupId || undefined,
        title: memberData.title || "",
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
    validators: {
      onSubmit: formSchema,
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <UserPlus className="h-5 w-5 text-primary-foreground" />
          </div>
          Add Team Member
        </DialogTitle>
        <DialogDescription>
          {isFirstMember ? "Start by adding your own details." : "Add a new member to your team."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4 py-4">
        <form.Field name="name">
          {(field) => (
            <Field data-invalid={!field.state.meta.isValid}>
              <FieldLabel htmlFor="member-name">Name *</FieldLabel>
              <Input
                aria-invalid={!field.state.meta.isValid}
                id="member-name"
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="John Doe"
                value={field.state.value}
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
                aria-invalid={!field.state.meta.isValid}
                autoComplete="email"
                id="member-email"
                inputMode="email"
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="m@example.com"
                type="email"
                value={field.state.value}
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
                aria-invalid={!field.state.meta.isValid}
                id="member-title"
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder={titlePlaceholder}
                value={field.state.value}
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
                onValueChange={(value) => {
                  if (value === null) {
                    return;
                  }
                  field.handleChange(value as FormValues["timezone"]);
                  field.handleBlur();
                }}
                value={field.state.value}
              >
                <SelectTrigger aria-invalid={!field.state.meta.isValid} id="member-timezone">
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
                  aria-invalid={!field.state.meta.isValid}
                  groups={groups}
                  id="member-group"
                  onValueChange={(value) => {
                    field.handleChange(value ?? "");
                    field.handleBlur();
                  }}
                  placeholder="No group"
                  value={field.state.value || undefined}
                />
                {!field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )}
          </form.Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <form.Field name="workingHoursStart">
            {(field) => (
              <Field data-invalid={!field.state.meta.isValid}>
                <FieldLabel htmlFor="member-work-start">Work Starts</FieldLabel>
                <Select
                  onValueChange={(value) => {
                    if (value === null) {
                      return;
                    }
                    field.handleChange(Number(value));
                    field.handleBlur();
                  }}
                  value={String(field.state.value)}
                >
                  <SelectTrigger aria-invalid={!field.state.meta.isValid} id="member-work-start">
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
                  onValueChange={(value) => {
                    if (value === null) {
                      return;
                    }
                    field.handleChange(Number(value));
                    field.handleBlur();
                  }}
                  value={String(field.state.value)}
                >
                  <SelectTrigger aria-invalid={!field.state.meta.isValid} id="member-work-end">
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
            disabled={form.state.isSubmitting}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
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
            <Button disabled={isSubmitting || !canSubmit} type="submit">
              {isSubmitting ? (
                <span className="flex items-center gap-2">
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
  groups,
  isFirstMember,
  onMemberAdded,
  teamId,
}: AddMemberDialogProps) => {
  const [open, setOpen] = useState(isFirstMember);
  // Bumped after close animation completes so the next open gets a fresh form
  // without unmounting mid-animation (which caused a visible close flicker).
  const [instanceId, setInstanceId] = useState(0);

  return (
    // Controlled: opens automatically when the team has no members yet
    // (isFirstMember), needs programmatic close on submit success, and
    // re-keys the form after the close animation completes.
    <Dialog
      onOpenChange={setOpen}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) {
          setInstanceId((n) => n + 1);
        }
      }}
      open={open}
    >
      <DialogTrigger render={<Button size="sm" type="button" />}>
        <UserPlus className="size-4" />
        Add Team Member
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <AddMemberForm
          groups={groups}
          isFirstMember={isFirstMember}
          key={instanceId}
          onMemberAdded={onMemberAdded}
          onOpenChange={setOpen}
          teamId={teamId}
        />
      </DialogContent>
    </Dialog>
  );
};

export { AddMemberDialog };
