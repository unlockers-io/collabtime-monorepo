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
  name: z.string().min(1, "Name is required"),
  title: z.string(),
  timezone: z.enum(COMMON_TIMEZONES, { message: "Invalid timezone" }),
  workingHoursStart: z.number().min(0).max(23),
  workingHoursEnd: z.number().min(0).max(23),
  groupId: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

const EditMemberForm = ({
  member,
  teamId,
  groups,
  mode,
  onOpenChange,
  onMemberUpdated,
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
    name: member.name,
    title: member.title ?? "",
    timezone: member.timezone as FormValues["timezone"],
    workingHoursStart: member.workingHoursStart,
    workingHoursEnd: member.workingHoursEnd,
    groupId: member.groupId ?? "",
  };

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: formSchema,
    },
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
              title: value.title || "",
              groupId: value.groupId || undefined,
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
          title: value.title || "",
          groupId: value.groupId || undefined,
        });
      });
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
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        noValidate
      >
        <div className="flex flex-col gap-4 py-2">
          <form.Field name="name">
            {(field) => (
              <Field data-invalid={!field.state.meta.isValid}>
                <FieldLabel htmlFor="edit-name">Name</FieldLabel>
                <Input
                  id="edit-name"
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

          <form.Field name="title">
            {(field) => (
              <Field data-invalid={!field.state.meta.isValid}>
                <FieldLabel htmlFor="edit-title">Title (optional)</FieldLabel>
                <Input
                  id="edit-title"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Software Engineer"
                  aria-invalid={!field.state.meta.isValid}
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
                  value={field.state.value}
                  onValueChange={(value) => {
                    field.handleChange(value as FormValues["timezone"]);
                    field.handleBlur();
                  }}
                >
                  <SelectTrigger id="edit-timezone" aria-invalid={!field.state.meta.isValid}>
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
                    id="edit-group"
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

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="workingHoursStart">
              {(field) => (
                <Field data-invalid={!field.state.meta.isValid}>
                  <FieldLabel htmlFor="edit-work-start">Work Starts</FieldLabel>
                  <Select
                    value={String(field.state.value)}
                    onValueChange={(value) => {
                      field.handleChange(Number(value));
                      field.handleBlur();
                    }}
                  >
                    <SelectTrigger id="edit-work-start" aria-invalid={!field.state.meta.isValid}>
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
                    value={String(field.state.value)}
                    onValueChange={(value) => {
                      field.handleChange(Number(value));
                      field.handleBlur();
                    }}
                  >
                    <SelectTrigger id="edit-work-end" aria-invalid={!field.state.meta.isValid}>
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
                id="invite-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="jane@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                aria-label="Send invitation"
                disabled={isInviting || !inviteEmail}
                onClick={handleSendInvitation}
              >
                {isInviting ? <Spinner /> : <Mail className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <form.Subscribe selector={(state) => ({ canSubmit: state.canSubmit })}>
            {({ canSubmit }) => (
              <Button type="submit" disabled={isPending || !canSubmit}>
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <Spinner />
                    Saving...
                  </span>
                ) : isClaim ? (
                  "Claim Profile"
                ) : (
                  "Save Changes"
                )}
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </form>
    </>
  );
};

const EditMemberDialog = ({
  member,
  teamId,
  groups,
  mode = "admin",
  open,
  onOpenChange,
  onMemberUpdated,
}: EditMemberDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {open && (
          <EditMemberForm
            key={member.id}
            member={member}
            teamId={teamId}
            groups={groups}
            mode={mode}
            onOpenChange={onOpenChange}
            onMemberUpdated={onMemberUpdated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export { EditMemberDialog };
