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
import { FieldSeparator } from "@repo/ui/components/field";
import { Spinner } from "@repo/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { HourSelectField } from "@/components/hour-select-field";
import {
  MemberGroupField,
  MemberTextField,
  TITLE_PLACEHOLDER,
  WorkingHoursFieldset,
} from "@/components/member-form-fields";
import { TimezoneField } from "@/components/timezone-field";
import { teamQueryKeys } from "@/hooks/use-team-query";
import { inviteMember } from "@/lib/actions/invitation-actions";
import { addMember } from "@/lib/actions/member-actions";
import { queryKeys } from "@/lib/query-keys";
import {
  DEFAULT_WORKING_HOURS_END,
  DEFAULT_WORKING_HOURS_START,
  getUserTimezone,
  isCommonTimezone,
} from "@/lib/timezones";
import type { TeamGroup } from "@/types";

type AddMemberDialogProps = {
  groups: Array<TeamGroup>;
  isFirstMember: boolean;
  teamId: string;
};

const formSchema = z.object({
  email: z.email("Invalid email address").or(z.literal("")),
  groupId: z.string(),
  name: z.string().min(1, "Name is required"),
  timezone: z.string().refine(isCommonTimezone, { message: "Invalid timezone" }),
  title: z.string(),
  workingHoursEnd: z.number().min(0).max(23),
  workingHoursStart: z.number().min(0).max(23),
});

type FormValues = z.input<typeof formSchema>;

type AddMemberFormProps = {
  groups: Array<TeamGroup>;
  isFirstMember: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
};

const AddMemberForm = ({ groups, isFirstMember, onOpenChange, teamId }: AddMemberFormProps) => {
  const queryClient = useQueryClient();

  const [defaultValues] = useState<FormValues>(() => ({
    email: "",
    groupId: "",
    name: "",
    timezone: getUserTimezone(),
    title: "",
    workingHoursEnd: DEFAULT_WORKING_HOURS_END,
    workingHoursStart: DEFAULT_WORKING_HOURS_START,
  }));

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
            void queryClient.invalidateQueries({ queryKey: queryKeys.teamInvitations(teamId) });
            if (inviteResult.data.emailSent) {
              toast.success(`Invitation sent to ${emailValue}`);
            } else {
              toast.success(`Invitation created for ${emailValue} (email was not delivered)`);
            }
          } else {
            toast.error(inviteResult.error);
          }
        }
      } else {
        toast.error(result.error);
      }
    },
    validators: { onBlur: formSchema, onChange: formSchema, onSubmit: formSchema },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <DialogHeader>
        <DialogTitle>Add team member</DialogTitle>
        <DialogDescription>
          {isFirstMember ? "Start with your own details." : "Add someone to the team timeline."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="name">
            {(field) => (
              <MemberTextField
                errors={field.state.meta.errors}
                id="member-name"
                isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                label="Full name"
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                placeholder="Jane Doe"
                required
                value={field.state.value}
              />
            )}
          </form.Field>

          <form.Field name="title">
            {(field) => (
              <MemberTextField
                errors={field.state.meta.errors}
                id="member-title"
                isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                label="Title (optional)"
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                placeholder={TITLE_PLACEHOLDER}
                value={field.state.value}
              />
            )}
          </form.Field>
        </div>

        <FieldSeparator />

        <form.Field name="timezone">
          {(field) => (
            <TimezoneField
              errors={field.state.meta.errors}
              id="member-timezone"
              isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              value={field.state.value}
            />
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.values.timezone}>
          {(timezone) => (
            <WorkingHoursFieldset timezone={timezone}>
              <form.Field name="workingHoursStart">
                {(field) => (
                  <HourSelectField
                    errors={field.state.meta.errors}
                    id="member-work-start"
                    isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    label="Starts"
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                    value={field.state.value}
                  />
                )}
              </form.Field>

              <form.Field name="workingHoursEnd">
                {(field) => (
                  <HourSelectField
                    errors={field.state.meta.errors}
                    id="member-work-end"
                    isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    label="Ends"
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                    value={field.state.value}
                  />
                )}
              </form.Field>
            </WorkingHoursFieldset>
          )}
        </form.Subscribe>

        {groups.length > 0 && (
          <>
            <FieldSeparator />
            <form.Field name="groupId">
              {(field) => (
                <MemberGroupField
                  errors={field.state.meta.errors}
                  groups={groups}
                  id="member-group"
                  isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                  label="Group (optional)"
                  onBlur={field.handleBlur}
                  onChange={field.handleChange}
                  value={field.state.value}
                />
              )}
            </form.Field>
          </>
        )}

        <FieldSeparator />

        <form.Field name="email">
          {(field) => (
            <MemberTextField
              autoComplete="off"
              description="We'll email a link so they can claim this profile."
              errors={field.state.meta.errors}
              id="member-email"
              isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
              label="Invite by email (optional)"
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              placeholder="name@company.com"
              type="email"
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>

      <DialogFooter>
        {!isFirstMember && (
          <Button
            disabled={form.state.isSubmitting}
            onClick={() => {
              onOpenChange(false);
            }}
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
                "Add member"
              )}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
};

const AddMemberDialog = ({ groups, isFirstMember, teamId }: AddMemberDialogProps) => {
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const [instanceId, setInstanceId] = useState(0);
  const open = openOverride ?? isFirstMember;

  return (
    <Dialog
      onOpenChange={setOpenOverride}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) {
          setInstanceId((n) => n + 1);
        }
      }}
      open={open}
    >
      <DialogTrigger render={<Button size="sm" type="button" />}>
        <UserPlus className="size-4" />
        Add team member
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <AddMemberForm
          groups={groups}
          isFirstMember={isFirstMember}
          key={instanceId}
          onOpenChange={setOpenOverride}
          teamId={teamId}
        />
      </DialogContent>
    </Dialog>
  );
};

export { AddMemberDialog };
