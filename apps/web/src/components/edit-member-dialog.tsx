"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useEffect, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { GroupSelector } from "@/components/group-selector";
import { updateMember } from "@/lib/actions";
import { COMMON_TIMEZONES, formatTimezoneLabel } from "@/lib/timezones";
import { formatHour } from "@/lib/utils";
import type { TeamGroup, TeamMember } from "@/types";

type EditMemberDialogProps = {
  groups: Array<TeamGroup>;
  member: TeamMember;
  onMemberUpdated: (member: TeamMember) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  teamId: string;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

type EditMemberFormProps = {
  groups: Array<TeamGroup>;
  member: TeamMember;
  onMemberUpdated: (member: TeamMember) => void;
  onOpenChange: (open: boolean) => void;
  teamId: string;
};

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  title: z.string().optional(),
  timezone: z.enum(COMMON_TIMEZONES, { message: "Invalid timezone" }),
  workingHoursStart: z.number().min(0).max(23),
  workingHoursEnd: z.number().min(0).max(23),
  groupId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const EditMemberForm = ({
  member,
  teamId,
  groups,
  onOpenChange,
  onMemberUpdated,
}: EditMemberFormProps) => {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      name: member.name,
      title: member.title,
      timezone: member.timezone as FormValues["timezone"],
      workingHoursStart: member.workingHoursStart,
      workingHoursEnd: member.workingHoursEnd,
      groupId: member.groupId,
    },
  });

  useEffect(() => {
    form.reset({
      name: member.name,
      title: member.title,
      timezone: member.timezone as FormValues["timezone"],
      workingHoursStart: member.workingHoursStart,
      workingHoursEnd: member.workingHoursEnd,
      groupId: member.groupId,
    });
  }, [form, member]);

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      const result = await updateMember(teamId, member.id, {
        ...data,
        title: data.title ?? "",
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Member updated");
      onOpenChange(false);
      onMemberUpdated({
        ...member,
        ...data,
        title: data.title ?? "",
      });
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit Member</DialogTitle>
        <DialogDescription>Update {member.name}&apos;s profile information.</DialogDescription>
      </DialogHeader>

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-4 py-2">
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="edit-name">Name</FieldLabel>
                <Input
                  {...field}
                  id="edit-name"
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
                <FieldLabel htmlFor="edit-title">Title (optional)</FieldLabel>
                <Input
                  {...field}
                  id="edit-title"
                  value={field.value ?? ""}
                  placeholder="Software Engineer"
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
                <FieldLabel htmlFor="edit-timezone">Timezone</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="edit-timezone" aria-invalid={fieldState.invalid}>
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
                  <FieldLabel htmlFor="edit-group">Group</FieldLabel>
                  <GroupSelector
                    id="edit-group"
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
                  <FieldLabel htmlFor="edit-work-start">Work Starts</FieldLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <SelectTrigger id="edit-work-start" aria-invalid={fieldState.invalid}>
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
                  <FieldLabel htmlFor="edit-work-end">Work Ends</FieldLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <SelectTrigger id="edit-work-end" aria-invalid={fieldState.invalid}>
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
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending || !form.formState.isValid}>
            {isPending ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Saving…
              </span>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
};

const EditMemberDialog = ({
  member,
  teamId,
  groups,
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
            onOpenChange={onOpenChange}
            onMemberUpdated={onMemberUpdated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export { EditMemberDialog };
