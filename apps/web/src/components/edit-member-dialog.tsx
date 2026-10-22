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
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { useTransition } from "react";
import { toast } from "sonner";

import { MemberFields } from "@/components/member-fields";
import { MEMBER_FIELDS, useMemberForm } from "@/hooks/use-member-form";
import { useTeamWrite } from "@/hooks/use-team-write";
import { updateMember, updateOwnMember } from "@/lib/actions/member-actions";
import { memberFormSchema, toMemberFormValues, toMemberInput } from "@/lib/member-input";
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
  const writeTeam = useTeamWrite(teamId);
  const isClaim = mode === "claim";
  const [isPending, startTransition] = useTransition();

  const form = useMemberForm({
    defaultValues: toMemberFormValues(member),
    onSubmit: ({ value }) => {
      startTransition(async () => {
        const input = toMemberInput(value);
        const { groupId: _groupId, ...ownInput } = input;

        const result = await writeTeam({
          submit: () =>
            isClaim
              ? updateOwnMember(teamId, member.id, ownInput)
              : updateMember(teamId, member.id, input),
        });

        if (!result.success) {
          toast.error(result.error);

          return;
        }

        toast.success(isClaim ? "Profile claimed" : "Member updated");
        onOpenChange(false);
      });
    },
    validators: {
      onBlur: memberFormSchema,
      onChange: memberFormSchema,
      onSubmit: memberFormSchema,
    },
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

      <ClientReadyForm
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <div className="flex flex-col gap-5 py-4">
          <MemberFields
            fields={MEMBER_FIELDS}
            form={form}
            groups={isClaim ? [] : groups}
            idPrefix="edit"
          />

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
      </ClientReadyForm>
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
