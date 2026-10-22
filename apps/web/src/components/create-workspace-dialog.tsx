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
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { z } from "zod";

import { createTeam } from "@/lib/actions/team-create";
import type { ActionResult } from "@/lib/actions/types";
import { getUserTimezone } from "@/lib/timezones";
import { TeamNameSchema } from "@/lib/validation";

const schema = z.object({ name: TeamNameSchema });
type Props = {
  createWorkspace: (name: string) => Promise<ActionResult<string>>;
  onCreated: (id: string) => void;
};
export const CreateWorkspaceDialogView = ({ createWorkspace, onCreated }: Props) => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const ready = useClientReady();
  const form = useForm({
    defaultValues: { name: "" },
    listeners: {
      onChange: () => {
        setError(null);
      },
    },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        const result = await createWorkspace(value.name.trim());
        if (!result.success) {
          setError(result.error);
          return;
        }
        setOpen(false);
        onCreated(result.data);
      } catch {
        setError("Could not create your workspace. Please try again.");
      }
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
  });
  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          form.reset();
          setError(null);
        }
      }}
      open={open}
    >
      <DialogTrigger disabled={!ready} render={<Button size="lg" />}>
        Create a workspace
      </DialogTrigger>
      <DialogContent>
        <ClientReadyForm
          id={form.formId}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Name your workspace</DialogTitle>
            <DialogDescription>Choose a name your teammates will recognize.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <FormAlert message={error} />
            <form.Field name="name">
              {(field) => {
                const invalid = !field.state.meta.isValid;
                return (
                  <Field data-invalid={invalid || undefined}>
                    <FieldLabel htmlFor={id}>Workspace name</FieldLabel>
                    <Input
                      aria-describedby={invalid ? `${id}-hint ${id}-error` : `${id}-hint`}
                      aria-invalid={invalid}
                      autoComplete="off"
                      id={id}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                      }}
                      value={field.state.value}
                    />
                    <FieldDescription id={`${id}-hint`}>Up to 100 characters.</FieldDescription>
                    {invalid && (
                      <FormFieldError errors={field.state.meta.errors} id={`${id}-error`} />
                    )}
                  </Field>
                );
              }}
            </form.Field>
          </div>
          <form.Subscribe
            selector={(state) => ({
              isEmpty: state.values.name.trim() === "",
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ isEmpty, isSubmitting }) => (
              <DialogFooter>
                <Button
                  disabled={isSubmitting}
                  onClick={() => {
                    setOpen(false);
                  }}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button disabled={isEmpty || isSubmitting} type="submit">
                  {isSubmitting ? "Creating…" : "Create workspace"}
                </Button>
              </DialogFooter>
            )}
          </form.Subscribe>
        </ClientReadyForm>
      </DialogContent>
    </Dialog>
  );
};
const createWorkspace = (name: string) => createTeam(getUserTimezone(), name);
export const CreateWorkspaceDialog = () => {
  const { push } = useRouter();
  return (
    <CreateWorkspaceDialogView
      createWorkspace={createWorkspace}
      onCreated={(id) => {
        push(`/${id}`);
      }}
    />
  );
};
