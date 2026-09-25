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
import { Spinner } from "@repo/ui/components/spinner";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { teamQueryKeys } from "@/hooks/use-team-query";
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
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const form = useForm({
    defaultValues: DEFAULT_VALUES,
    onSubmit: async ({ value }) => {
      const result = await createGroup(teamId, { name: value.name });

      if (result.success) {
        setOpen(false);
        void queryClient.invalidateQueries({ queryKey: teamQueryKeys.team(teamId) });
        toast.success(`Group "${value.name}" created`);
      } else {
        toast.error(result.error);
      }
    },
    validators: { onBlur: formSchema, onChange: formSchema, onSubmit: formSchema },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      form.reset();
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
        <form
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

          <div className="py-4">
            <form.Field name="name">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <FieldLabel htmlFor="group-name">Group name</FieldLabel>
                    <Input
                      aria-describedby={isInvalid ? "group-name-error" : undefined}
                      aria-invalid={isInvalid}
                      id="group-name"
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                      }}
                      placeholder="e.g. Engineering"
                      value={field.state.value}
                    />
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
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button disabled={isSubmitting || !canSubmit} type="submit">
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
        </form>
      </DialogContent>
    </Dialog>
  );
};

export { AddGroupDialog };
