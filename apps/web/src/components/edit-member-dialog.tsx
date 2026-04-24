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
import { Mail } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { GroupSelector } from "@/components/group-selector";
import { inviteMember } from "@/lib/actions/invitation-actions";
import { updateMember, updateOwnMember } from "@/lib/actions/member-actions";
import { COMMON_TIMEZONES, formatTimezoneLabel } from "@/lib/timezones";
import { formatHour } from "@/lib/utils";
import type { TeamGroup, TeamMember } from "@/types";

type EditMemberDialogProps = {
  groups: Array<TeamGroup>;
  member: TeamMember;
  mode?: "admin" | "claim";
  onMemberUpdated: (member: TeamMember) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  teamId: string;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

type EditMemberFormProps = {
  groups: Array<TeamGroup>;
  member: TeamMember;
  mode: "admin" | "claim";
  onMemberUpdated: (member: TeamMember) => void;
  onOpenChange: (open: boolean) => void;
  teamId: string;
};

const formSchema = z.object({
  groupId: z.string(),
  name: z.string().min(1, "Name is required"),
  timezone: z.enum(COMMON_TIMEZONES, { message: "Invalid timezone" }),
  title: z.string(),
  workingHoursEnd: z.number().min(0).max(23),
  workingHoursStart: z.number().min(0).max(23),
});

type FormValues = z.infer<typeof formSchema>;

const EditMemberForm = ({
  groups,
  member,
  mode,
  onMemberUpdated,
  onOpenChange,
  teamId,
}: EditMemberFormProps) => {
  const isClaim = mode === "claim";
  const [isPending, startTransition] = useTransition();
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  const handleSendInvitation = async () => {
    setIsInviting(true);
    try {
      const result = await inviteMember(teamId, member.id, inviteEmail);
      if (result.success) {
        if (result.data.emailSent) {
          toast.success(`Invitation sent to ${inviteEmail}`);
        } else {
          toast.success(`Invitation created for ${inviteEmail}`);
        }
        setInviteEmail("");
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsInviting(false);
    }
  };

  const defaultValues: FormValues = {
    groupId: member.groupId ?? "",
    name: member.name,
    timezone: member.timezone as FormValues["timezone"],
    title: member.title ?? "",
    workingHoursEnd: member.workingHoursEnd,
    workingHoursStart: member.workingHoursStart,
  };

  const form = useForm({
    defaultValues,
    onSubmit: ({ value }) => {
      startTransition(async () => {
        const { groupId: _stripped, ...claimSafeData } = value;
        const result = isClaim
          ? await updateOwnMember(teamId, member.id, {
              ...claimSafeData,
              title: claimSafeData.title || "",
            })
          : await updateMember(teamId, member.id, {
              ...value,
              groupId: value.groupId || undefined,
              title: value.title || "",
            });
        if (!result.success) {
          toast.error(result.error);
          return;
        }

        toast.success(isClaim ? "Profile claimed" : "Member updated");
        onOpenChange(false);
        onMemberUpdated({
          ...member,
          ...value,
          groupId: value.groupId || undefined,
          title: value.title || "",
        });
      });
    },
    validators: {
      onSubmit: formSchema,
    },
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isClaim ? "Claim this profile" : "Edit Member"}</DialogTitle>
        <DialogDescription>
          {isClaim
            ? "This looks like you — update your profile information."
            : `Update ${member.name}'s profile information.`}
        </DialogDescription>
      </DialogHeader>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div className="flex flex-col gap-4 py-2">
          <form.Field name="name">
            {(field) => (
              <Field data-invalid={!field.state.meta.isValid}>
                <FieldLabel htmlFor="edit-name">Name</FieldLabel>
                <Input
                  aria-invalid={!field.state.meta.isValid}
                  id="edit-name"
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="John Doe"
                  value={field.state.value}
                />
                {!field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )}
          </form.Field>

          <form.Field name="title">
            {(field) => (
              <Field data-invalid={!field.state.meta.isValid}>
                <FieldLabel htmlFor="edit-title">Title (optional)</FieldLabel>
                <Input
                  aria-invalid={!field.state.meta.isValid}
                  id="edit-title"
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Software Engineer"
                  value={field.state.value}
                />
                {!field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )}
          </form.Field>

          <form.Field name="timezone">
            {(field) => (
              <Field data-invalid={!field.state.meta.isValid}>
                <FieldLabel htmlFor="edit-timezone">Timezone</FieldLabel>
                <Select
                  onValueChange={(value) => {
                    field.handleChange(value as FormValues["timezone"]);
                    field.handleBlur();
                  }}
                  value={field.state.value}
                >
                  <SelectTrigger aria-invalid={!field.state.meta.isValid} id="edit-timezone">
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

          {!isClaim && groups.length > 0 && (
            <form.Field name="groupId">
              {(field) => (
                <Field data-invalid={!field.state.meta.isValid}>
                  <FieldLabel htmlFor="edit-group">Group</FieldLabel>
                  <GroupSelector
                    aria-invalid={!field.state.meta.isValid}
                    groups={groups}
                    id="edit-group"
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
                  <FieldLabel htmlFor="edit-work-start">Work Starts</FieldLabel>
                  <Select
                    onValueChange={(value) => {
                      field.handleChange(Number(value));
                      field.handleBlur();
                    }}
                    value={String(field.state.value)}
                  >
                    <SelectTrigger aria-invalid={!field.state.meta.isValid} id="edit-work-start">
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
                  <FieldLabel htmlFor="edit-work-end">Work Ends</FieldLabel>
                  <Select
                    onValueChange={(value) => {
                      field.handleChange(Number(value));
                      field.handleBlur();
                    }}
                    value={String(field.state.value)}
                  >
                    <SelectTrigger aria-invalid={!field.state.meta.isValid} id="edit-work-end">
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

        {!isClaim && !member.userId && (
          <div className="border-t border-border pt-4">
            <FieldLabel htmlFor="invite-email">Invite User</FieldLabel>
            <div className="flex gap-2">
              <Input
                autoComplete="email"
                id="invite-email"
                inputMode="email"
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="jane@example.com"
                type="email"
                value={inviteEmail}
              />
              <Button
                aria-label="Send invitation"
                disabled={isInviting || !inviteEmail}
                onClick={handleSendInvitation}
                type="button"
                variant="outline"
              >
                {isInviting ? <Spinner /> : <Mail className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <form.Subscribe selector={(state) => ({ canSubmit: state.canSubmit })}>
            {({ canSubmit }) => {
              const renderLabel = () => {
                if (isPending) {
                  return (
                    <span className="flex items-center gap-2">
                      <Spinner />
                      Saving...
                    </span>
                  );
                }
                if (isClaim) {
                  return "Claim Profile";
                }
                return "Save Changes";
              };
              return (
                <Button disabled={isPending || !canSubmit} type="submit">
                  {renderLabel()}
                </Button>
              );
            }}
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
  onMemberUpdated,
  onOpenChange,
  open,
  teamId,
}: EditMemberDialogProps) => {
  return (
    // Controlled: open state lives in MemberCard so the trigger button can
    // sit in the card header while the dialog renders as a sibling, and so
    // the form can close programmatically once the mutation resolves.
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <EditMemberForm
          groups={groups}
          key={member.id}
          member={member}
          mode={mode}
          onMemberUpdated={onMemberUpdated}
          onOpenChange={onOpenChange}
          teamId={teamId}
        />
      </DialogContent>
    </Dialog>
  );
};

export { EditMemberDialog };
