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
import { Field, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useForm } from "@tanstack/react-form";
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
  const form = useForm({
    canSubmitWhenInvalid: true,
    defaultValues: { name: "" },
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
    validators: { onBlur: schema, onChange: schema, onSubmit: schema },
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
      <DialogTrigger render={<Button size="lg" />}>Create a workspace</DialogTrigger>
      <DialogContent>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Name your workspace</DialogTitle>
            <DialogDescription>Choose a name your teammates will recognize.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <form.Field name="name">
              {(field) => {
                const invalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={invalid || undefined}>
                    <FieldLabel htmlFor={id}>Workspace name</FieldLabel>
                    <Input
                      aria-describedby={invalid ? `${id}-error` : undefined}
                      aria-invalid={invalid}
                      autoComplete="off"
                      id={id}
                      maxLength={100}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                      }}
                      value={field.state.value}
                    />
                    {invalid && (
                      <FormFieldError errors={field.state.meta.errors} id={`${id}-error`} />
                    )}
                  </Field>
                );
              }}
            </form.Field>
            {error !== null && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
          <form.Subscribe
            selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
          >
            {({ canSubmit, isSubmitting }) => (
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
                <Button disabled={!canSubmit || isSubmitting} type="submit">
                  {isSubmitting ? "Creating…" : "Create workspace"}
                </Button>
              </DialogFooter>
            )}
          </form.Subscribe>
        </form>
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
