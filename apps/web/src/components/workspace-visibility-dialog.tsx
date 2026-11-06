"use client";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { captureException } from "@sentry/nextjs";
import { revalidateLogic, useForm, useSelector } from "@tanstack/react-form";
import { Check, Copy } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { TextField } from "@/components/text-field";
import type { ActionResult } from "@/lib/actions/types";
import { readApiError } from "@/lib/api-error";
import { bindField } from "@/lib/bind-field";
import { SPACE_PASSWORD_LENGTH } from "@/lib/limits";
import { SpaceAccessPasswordSchema } from "@/lib/validation";

const savedSpaceSchema = z.object({
  space: z.object({ hasPassword: z.boolean(), isPrivate: z.boolean() }),
});

type VisibilityUpdate = { password?: string; visibility: "private" | "public" };

type Visibility = { hasPassword: boolean; isPrivate: boolean };

type VisibilityValues = { isPrivate: boolean; password: string };

type WorkspaceVisibilityDialogProps = Visibility & {
  onOpenChange: (open: boolean) => void;
  onSaved: (space: Visibility) => void;
  open: boolean;
  spaceId: string;
};

const NO_CHANGES = "No changes to save.";

const toVisibilityUpdate = ({ isPrivate, password }: VisibilityValues): VisibilityUpdate =>
  isPrivate && password !== ""
    ? { password, visibility: "private" }
    : { visibility: isPrivate ? "private" : "public" };

const saveVisibility = async (
  spaceId: string,
  update: VisibilityUpdate,
): Promise<ActionResult<Visibility>> => {
  try {
    const response = await fetch(`/api/spaces/${spaceId}`, {
      body: JSON.stringify(update),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });

    if (!response.ok) {
      return {
        error: await readApiError(response, "Couldn't update workspace privacy"),
        success: false,
      };
    }

    return { data: savedSpaceSchema.parse(await response.json()).space, success: true };
  } catch (error) {
    captureException(error);

    return { error: "Couldn't update workspace privacy. Please try again.", success: false };
  }
};

const readShareUrl = () => `${window.location.origin}${window.location.pathname}`;
const emptySubscribe = () => () => {};

const ShareLink = () => {
  const url = useSyncExternalStore(emptySubscribe, readShareUrl, () => "");
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setHasCopied(true);
    } catch {
      toast.error("Couldn't copy the link. Select it and copy it instead.");
    }
  };

  return (
    <Field>
      <FieldLabel htmlFor="workspace-share-link">Workspace link</FieldLabel>
      <div className="flex gap-2">
        <Input
          id="workspace-share-link"
          onFocus={(event) => {
            event.currentTarget.select();
          }}
          readOnly
          value={url}
        />
        <Button
          onClick={() => {
            void handleCopy();
          }}
          type="button"
          variant="outline"
        >
          {hasCopied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {hasCopied ? "Copied" : "Copy"}
        </Button>
      </div>
    </Field>
  );
};

const WorkspaceVisibilityDialog = ({
  hasPassword,
  isPrivate,
  onOpenChange,
  onSaved,
  open,
  spaceId,
}: WorkspaceVisibilityDialogProps) => {
  const schema = z
    .object({ isPrivate: z.boolean(), password: z.string() })
    .superRefine((value, ctx) => {
      if (!value.isPrivate || (hasPassword && value.password === "")) {
        return;
      }

      const result = SpaceAccessPasswordSchema.safeParse(value.password);

      if (!result.success) {
        ctx.addIssue({
          code: "custom",
          message: result.error.issues[0]?.message ?? "A password is required",
          path: ["password"],
        });
      }
    });

  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { isPrivate, password: "" },
    listeners: {
      onChange: () => {
        setFormError(null);
      },
    },
    onSubmit: async ({ value }) => {
      if (value.isPrivate === isPrivate && value.password === "") {
        setFormError(NO_CHANGES);

        return;
      }

      setFormError(null);
      const result = await saveVisibility(spaceId, toVisibilityUpdate(value));

      if (!result.success) {
        setFormError(result.error);

        return;
      }

      onSaved(result.data);
      onOpenChange(false);
      toast.success("Workspace privacy updated");
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
  });

  const isSaving = useSelector(form.store, (state) => state.isSubmitting);
  const ready = useClientReady();

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!form.state.isSubmitting) {
          onOpenChange(next);
        }
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sharing &amp; privacy</DialogTitle>
          <DialogDescription>Choose who can open this workspace&apos;s link.</DialogDescription>
        </DialogHeader>
        <ShareLink />
        <ClientReadyForm
          id={form.formId}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <FormAlert message={formError} />
            <form.Field name="isPrivate">
              {(field) => (
                <Field className="flex-row items-center justify-between">
                  <FieldLabel htmlFor="workspace-private">Private workspace</FieldLabel>
                  <Switch
                    checked={field.state.value}
                    disabled={!ready || isSaving}
                    id="workspace-private"
                    onBlur={field.handleBlur}
                    onCheckedChange={field.handleChange}
                  />
                </Field>
              )}
            </form.Field>
            <form.Subscribe selector={(state) => state.values.isPrivate}>
              {(privateWorkspace) => (
                <p className="text-sm text-pretty text-muted-foreground">
                  {privateWorkspace
                    ? "Only members, and guests with the password, can open the link."
                    : "Anyone with the link can see each person's name, title, timezone, working hours and group, without signing in. Guests can't change anything."}
                </p>
              )}
            </form.Subscribe>
            <form.Subscribe selector={(state) => state.values.isPrivate}>
              {(privateWorkspace) =>
                privateWorkspace && (
                  <form.Field name="password">
                    {(field) => (
                      <TextField
                        {...bindField(field)}
                        autoComplete="new-password"
                        description={
                          hasPassword
                            ? "Leave blank to keep current password."
                            : `Set a password to share with guests (${SPACE_PASSWORD_LENGTH.min}–${SPACE_PASSWORD_LENGTH.max} characters).`
                        }
                        disabled={isSaving}
                        id="workspace-access-password"
                        label="Workspace password"
                        type="password"
                      />
                    )}
                  </form.Field>
                )
              }
            </form.Subscribe>
          </FieldGroup>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <DialogFooter className="mt-6">
                <Button
                  disabled={isSubmitting}
                  onClick={() => {
                    onOpenChange(false);
                  }}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            )}
          </form.Subscribe>
        </ClientReadyForm>
      </DialogContent>
    </Dialog>
  );
};

export { WorkspaceVisibilityDialog };
