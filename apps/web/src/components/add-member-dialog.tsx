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
import { toast } from "@repo/ui/components/sonner";
import { Spinner } from "@repo/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { GroupSelector } from "@/components/group-selector";
import { teamQueryKeys } from "@/hooks/use-team-query";
import { inviteMember } from "@/lib/actions/invitation-actions";
import { addMember } from "@/lib/actions/member-actions";
import { COMMON_TIMEZONES, formatTimezoneLabel, getUserTimezone } from "@/lib/timezones";
import { formatHour } from "@/lib/utils";
import type { TeamGroup } from "@/types";

type AddMemberDialogProps = {
  groups: Array<TeamGroup>;
  isFirstMember: boolean;
  teamId: string;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

type HourSelectFieldProps = {
  id: string;
  label: string;
  onBlur: () => void;
  onChange: (hour: number) => void;
  value: number;
};

const HourSelectField = ({ id, label, onBlur, onChange, value }: HourSelectFieldProps) => (
  <Field>
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <Select
      onValueChange={(v) => {
        if (v !== null) {
          onChange(Number(v));
          onBlur();
        }
      }}
      value={String(value)}
    >
      <SelectTrigger id={id}>
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
  </Field>
);

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
  onOpenChange: (open: boolean) => void;
  teamId: string;
};

const AddMemberForm = ({ groups, isFirstMember, onOpenChange, teamId }: AddMemberFormProps) => {
  const queryClient = useQueryClient();
  // useState lazy init so the placeholder is stable for this dialog instance;
  // setter is intentionally unused — the random placeholder must not change after mount
  const [titlePlaceholder, _setTitlePlaceholder] = useState(getRandomPlaceholder);

  const defaultValues: FormValues = {
    email: "",
    groupId: "",
    name: "",
    timezone: getUserTimezone() as FormValues["timezone"],
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
        void queryClient.invalidateQueries({ queryKey: teamQueryKeys.team(teamId) });
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
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary">
            <UserPlus className="size-5 text-primary-foreground" />
          </div>
          Add Team Member
        </DialogTitle>
        <DialogDescription>
          {isFirstMember ? "Start by adding your own details." : "Add a new member to your team."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4 py-4">
        <form.Field name="name">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid || undefined}>
                <FieldLabel htmlFor="member-name">Name *</FieldLabel>
                <Input
                  aria-describedby={isInvalid ? "member-name-error" : undefined}
                  aria-invalid={isInvalid}
                  id="member-name"
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="John Doe"
                  value={field.state.value}
                />
                {isInvalid && (
                  <FieldError errors={field.state.meta.errors} id="member-name-error" />
                )}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="email">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid || undefined}>
                <FieldLabel htmlFor="member-email">Email (optional)</FieldLabel>
                <Input
                  aria-describedby={isInvalid ? "member-email-error" : undefined}
                  aria-invalid={isInvalid}
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
                {isInvalid && (
                  <FieldError errors={field.state.meta.errors} id="member-email-error" />
                )}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="title">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid || undefined}>
                <FieldLabel htmlFor="member-title">Title (optional)</FieldLabel>
                <Input
                  aria-describedby={isInvalid ? "member-title-error" : undefined}
                  aria-invalid={isInvalid}
                  id="member-title"
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={titlePlaceholder}
                  value={field.state.value}
                />
                {isInvalid && (
                  <FieldError errors={field.state.meta.errors} id="member-title-error" />
                )}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="timezone">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid || undefined}>
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
                  <SelectTrigger aria-invalid={isInvalid} id="member-timezone">
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
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        {groups.length > 0 && (
          <form.Field name="groupId">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid || undefined}>
                  <FieldLabel htmlFor="member-group">Group (optional)</FieldLabel>
                  <GroupSelector
                    aria-invalid={isInvalid}
                    groups={groups}
                    id="member-group"
                    onValueChange={(value) => {
                      field.handleChange(value ?? "");
                      field.handleBlur();
                    }}
                    placeholder="No group"
                    value={field.state.value || undefined}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <form.Field name="workingHoursStart">
            {(field) => (
              <HourSelectField
                id="member-work-start"
                label="Work Starts"
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                value={field.state.value}
              />
            )}
          </form.Field>

          <form.Field name="workingHoursEnd">
            {(field) => (
              <HourSelectField
                id="member-work-end"
                label="Work Ends"
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                value={field.state.value}
              />
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
                  Adding…
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

const AddMemberDialog = ({ groups, isFirstMember, teamId }: AddMemberDialogProps) => {
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
          onOpenChange={setOpen}
          teamId={teamId}
        />
      </DialogContent>
    </Dialog>
  );
};

export { AddMemberDialog };
