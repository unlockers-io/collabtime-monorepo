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
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MemberFields } from "@/components/member-fields";
import { MemberTextField } from "@/components/member-text-field";
import { bindField, MEMBER_FIELDS, useMemberForm } from "@/hooks/use-member-form";
import { useTeamWrite } from "@/hooks/use-team-write";
import { inviteMember } from "@/lib/actions/invitation-actions";
import { addMember } from "@/lib/actions/member-actions";
import { addMemberFormSchema, NO_GROUP, toMemberInput } from "@/lib/member-input";
import type { AddMemberFormValues } from "@/lib/member-input";
import { queryKeys } from "@/lib/query-keys";
import {
  DEFAULT_WORKING_HOURS_END,
  DEFAULT_WORKING_HOURS_START,
  getUserTimezone,
} from "@/lib/timezones";
import type { TeamGroup } from "@/types";

type AddMemberDialogProps = {
  groups: Array<TeamGroup>;
  isFirstMember: boolean;
  teamId: string;
};

type AddMemberFormProps = {
  groups: Array<TeamGroup>;
  isFirstMember: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
};

const AddMemberForm = ({ groups, isFirstMember, onOpenChange, teamId }: AddMemberFormProps) => {
  const queryClient = useQueryClient();
  const writeTeam = useTeamWrite(teamId);

  const [defaultValues] = useState<AddMemberFormValues>(() => ({
    email: "",
    groupId: NO_GROUP,
    name: "",
    timezone: getUserTimezone(),
    title: "",
    workingHoursEnd: DEFAULT_WORKING_HOURS_END,
    workingHoursStart: DEFAULT_WORKING_HOURS_START,
  }));

  const form = useMemberForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      const { email } = value;
      const result = await writeTeam({ submit: () => addMember(teamId, toMemberInput(value)) });

      if (result.success) {
        onOpenChange(false);
        toast.success(`${value.name} added to team`);

        if (email) {
          const inviteResult = await inviteMember(teamId, result.data.member.id, email);
          if (inviteResult.success) {
            void queryClient.invalidateQueries({ queryKey: queryKeys.teamInvitations(teamId) });
            if (inviteResult.data.emailSent) {
              toast.success(`Invitation sent to ${email}`);
            } else {
              toast.success(`Invitation created for ${email} (email was not delivered)`);
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
      onBlur: addMemberFormSchema,
      onChange: addMemberFormSchema,
      onSubmit: addMemberFormSchema,
    },
  });

  return (
    <ClientReadyForm
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
        <MemberFields fields={MEMBER_FIELDS} form={form} groups={groups} idPrefix="member" />

        <FieldSeparator />

        <form.Field name="email">
          {(field) => (
            <MemberTextField
              {...bindField(field)}
              autoComplete="off"
              description="We'll email a link so they can claim this profile."
              id="member-email"
              label="Invite by email (optional)"
              placeholder="name@company.com"
              type="email"
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
    </ClientReadyForm>
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
