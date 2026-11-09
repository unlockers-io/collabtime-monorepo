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
import { Spinner } from "@repo/ui/components/spinner";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";

import { TextField } from "@/components/text-field";
import { useTeamWrite } from "@/hooks/use-team-write";
import { bindField } from "@/lib/bind-field";
import { GROUP_NAME_MAX_LENGTH, upToCharacters } from "@/lib/limits";
import { TeamGroupInputSchema } from "@/lib/validation";

type AddGroupDialogProps = {
  teamId: string;
};

type FormValues = z.input<typeof TeamGroupInputSchema>;

const DEFAULT_VALUES: FormValues = {
  name: "",
};

const AddGroupDialog = ({ teamId }: AddGroupDialogProps) => {
  const write = useTeamWrite(teamId);
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
      const result = await write.change("addGroup", value);

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
    validators: { onDynamic: TeamGroupInputSchema },
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
              {(field) => (
                <TextField
                  {...bindField(field)}
                  description={upToCharacters(GROUP_NAME_MAX_LENGTH)}
                  id="group-name"
                  label="Group name"
                  placeholder="e.g. Engineering"
                />
              )}
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
