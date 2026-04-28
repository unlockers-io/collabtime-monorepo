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
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { createGroup } from "@/lib/actions/group-actions";
import type { TeamGroup } from "@/types";

type AddGroupDialogProps = {
  onGroupAdded: (group: TeamGroup) => void;
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

const AddGroupDialog = ({ onGroupAdded, teamId }: AddGroupDialogProps) => {
  const [open, setOpen] = useState(false);

  const defaultValues: FormValues = {
    name: "",
  };

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      const result = await createGroup(teamId, { name: value.name });

      if (result.success) {
        setOpen(false);
        onGroupAdded(result.data.group);
        toast.success(`Group "${value.name}" created`);
      } else {
        toast.error(result.error);
      }
    },
    validators: {
      onSubmit: formSchema,
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      form.reset();
    }
  };

  return (
    // Controlled: needs programmatic close on successful submit and to reset
    // form state on the open transition (and again after the close animation).
    <Dialog
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={(nextOpen) => {
        // Reset after the close animation completes to avoid input re-render
        // flicker during fade-out.
        if (!nextOpen) {
          form.reset();
        }
      }}
      open={open}
    >
      <DialogTrigger render={<Button size="sm" type="button" />}>
        <Users className="size-4" />
        Add Group
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <Users className="h-5 w-5 text-primary-foreground" />
              </div>
              Add Group
            </DialogTitle>
            <DialogDescription>Create a new group to organize your team members.</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <form.Field name="name">
              {(field) => (
                <Field data-invalid={!field.state.meta.isValid}>
                  <FieldLabel htmlFor="group-name">Group Name</FieldLabel>
                  <Input
                    aria-invalid={!field.state.meta.isValid}
                    id="group-name"
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="e.g., Engineering, Design, Marketing..."
                    value={field.state.value}
                  />
                  {!field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )}
            </form.Field>
          </div>

          <DialogFooter>
            <Button
              disabled={form.state.isSubmitting}
              onClick={() => setOpen(false)}
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
                      Creating...
                    </span>
                  ) : (
                    "Create Group"
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
