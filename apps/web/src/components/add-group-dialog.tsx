"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { createGroup } from "@/lib/actions";
import type { TeamGroup } from "@/types";
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

type AddGroupDialogProps = {
  teamId: string;
  token: string;
  onGroupAdded: (group: TeamGroup) => void;
};

const formSchema = z.object({
  name: z
    .string()
    .min(1, "Group name is required")
    .max(50, "Group name must be 50 characters or less")
    .trim(),
});

type FormValues = z.infer<typeof formSchema>;

const AddGroupDialog = ({
  teamId,
  token,
  onGroupAdded,
}: AddGroupDialogProps) => {
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
    },
  });

  const { handleSubmit, reset, formState } = form;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      reset({ name: "" });
    }
  }, [open, reset]);

  const onSubmit = async (data: FormValues) => {
    const result = await createGroup(teamId, token, { name: data.name });

    if (result.success) {
      setOpen(false);
      onGroupAdded(result.data.group);
      toast.success(`Group "${data.name}" created`);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          type="button"
          className="group flex h-14 w-full items-center justify-center gap-2 border-2 border-dashed border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground hover:bg-muted"
        >
          <Users className="h-5 w-5 transition-transform group-hover:scale-110" />
          <span className="font-medium">Add Group</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <Users className="h-5 w-5 text-primary-foreground" />
              </div>
              Add Group
            </DialogTitle>
            <DialogDescription>
              Create a new group to organize your team members.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="group-name">Group Name</FieldLabel>
                  <Input
                    {...field}
                    id="group-name"
                    placeholder="e.g., Engineering, Design, Marketing…"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={formState.isSubmitting || !formState.isValid}
            >
              {formState.isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  Creating…
                </span>
              ) : (
                "Create Group"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export { AddGroupDialog };
