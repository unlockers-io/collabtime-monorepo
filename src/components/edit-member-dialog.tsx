"use client";

import { useEffect, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { TeamGroup, TeamMember } from "@/types";
import { updateMember } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { GroupSelector } from "@/components/group-selector";
import { COMMON_TIMEZONES, formatTimezoneLabel } from "@/lib/timezones";
import { formatHour } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

type EditMemberDialogProps = {
  member: TeamMember;
  teamId: string;
  token: string;
  groups: TeamGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberUpdated: (member: TeamMember) => void;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

type EditMemberFormProps = {
  member: TeamMember;
  teamId: string;
  token: string;
  groups: TeamGroup[];
  onOpenChange: (open: boolean) => void;
  onMemberUpdated: (member: TeamMember) => void;
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
  token,
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
      const result = await updateMember(teamId, token, member.id, {
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
        <DialogTitle className="text-neutral-900 dark:text-neutral-100">
          Edit Member
        </DialogTitle>
        <DialogDescription>
          Update {member.name}&apos;s profile information.
        </DialogDescription>
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
                      <SelectTrigger
                        id="edit-work-start"
                        aria-invalid={fieldState.invalid}
                      >
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
                <>
                  <Spinner className="mr-2" />
                  Saving…
                </>
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
  token,
  groups,
  open,
  onOpenChange,
  onMemberUpdated,
}: EditMemberDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white dark:bg-neutral-900">
        {open && (
          <EditMemberForm
            key={member.id}
            member={member}
            teamId={teamId}
            token={token}
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
