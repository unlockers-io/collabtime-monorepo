"use client";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { FieldSeparator } from "@repo/ui/components/field";
import { Spinner } from "@repo/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useTransition } from "react";
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
import { updateMember, updateOwnMember } from "@/lib/actions/member-actions";
import { DEFAULT_MEMBER_TIMEZONE, fuzzyMatchTimezone, isCommonTimezone } from "@/lib/timezones";
import type { PendingTeamInvitation, TeamGroup, TeamMember } from "@/types";

import { MemberInviteSection } from "./member-invite-section";

type EditMemberDialogProps = {
  groups: Array<TeamGroup>;
  member: TeamMember;
  mode?: "admin" | "claim";
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pendingInvite?: PendingTeamInvitation;
  teamId: string;
};

type EditMemberFormProps = Omit<EditMemberDialogProps, "open"> & { mode: "admin" | "claim" };

const formSchema = z.object({
  groupId: z.string(),
  name: z.string().min(1, "Name is required"),
  timezone: z.string().refine(isCommonTimezone, { message: "Invalid timezone" }),
  title: z.string(),
  workingHoursEnd: z.number().min(0).max(23),
  workingHoursStart: z.number().min(0).max(23),
});

type FormValues = z.input<typeof formSchema>;

type SaveButtonLabelProps = {
  isClaim: boolean;
  isPending: boolean;
};

const SaveButtonLabel = ({ isClaim, isPending }: SaveButtonLabelProps) => {
  if (isPending) {
    return (
      <span className="flex items-center gap-2">
        <Spinner />
        Saving…
      </span>
    );
  }
  if (isClaim) {
    return <>Claim profile</>;
  }
  return <>Save changes</>;
};

const EditMemberForm = ({
  groups,
  member,
  mode,
  onOpenChange,
  pendingInvite,
  teamId,
}: EditMemberFormProps) => {
  const queryClient = useQueryClient();
  const isClaim = mode === "claim";
  const [isPending, startTransition] = useTransition();
  const defaultValues: FormValues = {
    groupId: member.groupId ?? "",
    name: member.name,
    timezone: fuzzyMatchTimezone(member.timezone) ?? DEFAULT_MEMBER_TIMEZONE,
    title: member.title,
    workingHoursEnd: member.workingHoursEnd,
    workingHoursStart: member.workingHoursStart,
  };

  const form = useForm({
    defaultValues,
    onSubmit: ({ value }) => {
      startTransition(async () => {
        const { groupId: _stripped, ...claimSafeData } = value;
        const safeGroupId = value.groupId || undefined;
        const safeTitle = value.title || "";
        const result = isClaim
          ? await updateOwnMember(teamId, member.id, { ...claimSafeData, title: safeTitle })
          : await updateMember(teamId, member.id, {
              ...value,
              groupId: safeGroupId,
              title: safeTitle,
            });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success(isClaim ? "Profile claimed" : "Member updated");
        onOpenChange(false);
        void queryClient.invalidateQueries({ queryKey: teamQueryKeys.team(teamId) });
      });
    },
    validators: { onBlur: formSchema, onChange: formSchema, onSubmit: formSchema },
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isClaim ? "Claim this profile" : "Edit member"}</DialogTitle>
        <DialogDescription>
          {isClaim
            ? "This looks like you. Update your profile information."
            : `Update ${member.name}'s profile information.`}
        </DialogDescription>
      </DialogHeader>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <div className="flex flex-col gap-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="name">
              {(field) => (
                <MemberTextField
                  errors={field.state.meta.errors}
                  id="edit-name"
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
                  id="edit-title"
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
                id="edit-timezone"
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
                      id="edit-work-start"
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
                      id="edit-work-end"
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

          {!isClaim && groups.length > 0 && (
            <>
              <FieldSeparator />
              <form.Field name="groupId">
                {(field) => (
                  <MemberGroupField
                    errors={field.state.meta.errors}
                    groups={groups}
                    id="edit-group"
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

          {!isClaim && (member.userId === undefined || member.userId === "") && (
            <>
              <FieldSeparator />
              <MemberInviteSection
                memberId={member.id}
                pendingInvite={pendingInvite}
                teamId={teamId}
              />
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() => {
              onOpenChange(false);
            }}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <form.Subscribe selector={(state) => ({ canSubmit: state.canSubmit })}>
            {({ canSubmit }) => (
              <Button disabled={isPending || !canSubmit} type="submit">
                <SaveButtonLabel isClaim={isClaim} isPending={isPending} />
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </form>
    </>
  );
};

const EditMemberDialog = ({
  groups,
  member,
  mode = "admin",
  onOpenChange,
  open,
  pendingInvite,
  teamId,
}: EditMemberDialogProps) => {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <EditMemberForm
          groups={groups}
          key={member.id}
          member={member}
          mode={mode}
          onOpenChange={onOpenChange}
          pendingInvite={pendingInvite}
          teamId={teamId}
        />
      </DialogContent>
    </Dialog>
  );
};

export { EditMemberDialog };
