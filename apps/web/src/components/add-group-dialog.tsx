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
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { useTeamWrite } from "@/hooks/use-team-write";
import { createGroup } from "@/lib/actions/group-actions";

type AddGroupDialogProps = {
  teamId: string;
};

const formSchema = z.object({
  name: z
    .string()
    .min(1, "Group name is required")
    .max(50, "Group name must be 50 characters or less")
    .trim(),
});

type FormValues = z.infer<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
  name: "",
};

const AddGroupDialog = ({ teamId }: AddGroupDialogProps) => {
  const writeTeam = useTeamWrite(teamId);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: DEFAULT_VALUES,
    listeners: {
      onChange: () => {
        setFormError(null);
      },
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const result = await writeTeam({ submit: () => createGroup(teamId, { name: value.name }) });

      if (result.success) {
        setOpen(false);
        toast.success(`Group "${value.name}" created`);
      } else {
        setFormError(result.error);
      }
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: formSchema },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (nextOpen) {
      form.reset();
      setFormError(null);
    }
  };

  return (
    <Dialog
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) {
          form.reset();
        }
      }}
      open={open}
    >
      <DialogTrigger render={<Button size="sm" type="button" />}>
        <Users className="size-4" />
        Add group
      </DialogTrigger>
      <DialogContent>
        <ClientReadyForm
          id={form.formId}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Add group</DialogTitle>
            <DialogDescription>
              Organize members into sub-teams, like Engineering or Design.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <FormAlert message={formError} />
            <form.Field name="name">
              {(field) => {
                const isInvalid = !field.state.meta.isValid;

                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <FieldLabel htmlFor="group-name">Group name</FieldLabel>
                    <Input
                      aria-describedby={
                        isInvalid ? "group-name-hint group-name-error" : "group-name-hint"
                      }
                      aria-invalid={isInvalid}
                      id="group-name"
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                      }}
                      placeholder="e.g. Engineering"
                      value={field.state.value}
                    />
                    <FieldDescription id="group-name-hint">Up to 50 characters.</FieldDescription>
                    {isInvalid && (
                      <FormFieldError errors={field.state.meta.errors} id="group-name-error" />
                    )}
                  </Field>
                );
              }}
            </form.Field>
          </div>

          <DialogFooter>
            <Button
              disabled={form.state.isSubmitting}
              onClick={() => {
                setOpen(false);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(state) => ({
                isEmpty: state.values.name.trim() === "",
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ isEmpty, isSubmitting }) => (
                <Button disabled={isEmpty || isSubmitting} type="submit">
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Spinner />
                      Creating…
                    </span>
                  ) : (
                    "Create group"
                  )}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </ClientReadyForm>
      </DialogContent>
    </Dialog>
  );
};

export { AddGroupDialog };
