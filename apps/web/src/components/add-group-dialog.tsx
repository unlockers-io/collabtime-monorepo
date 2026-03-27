"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Spinner,
} from "@repo/ui";
import { useForm } from "@tanstack/react-form";
import { Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { createGroup } from "@/lib/actions";
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

const AddGroupDialog = ({ teamId, onGroupAdded }: AddGroupDialogProps) => {
  const [open, setOpen] = useState(false);

  const defaultValues: FormValues = {
    name: "",
  };

  const form = useForm({
    defaultValues,
    validators: {
      onBlur: formSchema,
    },
    onSubmit: async ({ value }) => {
      const result = await createGroup(teamId, { name: value.name });

      if (result.success) {
        setOpen(false);
        onGroupAdded(result.data.group);
        toast.success(`Group "${value.name}" created`);
        form.reset();
      } else {
        toast.error(result.error);
      }
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            type="button"
            className="group flex h-14 w-full items-center justify-center gap-2 border-2 border-dashed border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground hover:bg-muted"
          />
        }
      >
        <Users className="h-5 w-5 transition-transform group-hover:scale-110" />
        <span className="font-medium">Add Group</span>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          noValidate
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
                <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
                  <FieldLabel htmlFor="group-name">Group Name</FieldLabel>
                  <Input
                    id="group-name"
                    placeholder="e.g., Engineering, Design, Marketing..."
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                  />
                  {field.state.meta.isTouched && !field.state.meta.isValid && (
                    <FieldError errors={field.state.meta.errors} />
                  )}
                </Field>
              )}
            </form.Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={form.state.isSubmitting}
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
                <Button type="submit" disabled={isSubmitting || !canSubmit}>
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
