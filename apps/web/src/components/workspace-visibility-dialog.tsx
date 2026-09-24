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
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { captureException } from "@sentry/nextjs";
import { useForm, useSelector } from "@tanstack/react-form";
import { Check, Copy } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { SpaceAccessPasswordSchema } from "@/lib/validation";

const savedSpaceSchema = z.object({
  space: z.object({ hasPassword: z.boolean(), isPrivate: z.boolean() }),
});
const errorSchema = z.object({ error: z.string() });

type VisibilityUpdate = { password?: string; visibility: "private" | "public" };

type Visibility = { hasPassword: boolean; isPrivate: boolean };
type WorkspaceVisibilityDialogProps = Visibility & {
  onOpenChange: (open: boolean) => void;
  onSaved: (space: Visibility) => void;
  open: boolean;
  spaceId: string;
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
  const form = useForm({
    defaultValues: { isPrivate, password: "" },
    onSubmit: async ({ value }) => {
      const body: VisibilityUpdate = {
        visibility: value.isPrivate ? "private" : "public",
      };
      if (value.isPrivate && value.password !== "") {
        body.password = value.password;
      }
      try {
        const response = await fetch(`/api/spaces/${spaceId}`, {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (!response.ok) {
          const data: unknown = await response.json().catch(() => null);
          const parsed = errorSchema.safeParse(data);
          toast.error(parsed.success ? parsed.data.error : "Couldn't update workspace privacy");
          return;
        }
        const saved = savedSpaceSchema.parse(await response.json());
        onSaved(saved.space);
        onOpenChange(false);
        toast.success("Workspace privacy updated");
      } catch (error) {
        captureException(error);
        toast.error("Couldn't update workspace privacy. Please try again.");
      }
    },
    validators: { onBlur: schema, onChange: schema },
  });

  const isSaving = useSelector(form.store, (state) => state.isSubmitting);

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
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field name="isPrivate">
              {(field) => (
                <Field className="flex-row items-center justify-between">
                  <FieldLabel htmlFor="workspace-private">Private workspace</FieldLabel>
                  <Switch
                    checked={field.state.value}
                    disabled={isSaving}
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
                    {(field) => {
                      const invalid = field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={invalid || undefined}>
                          <FieldLabel htmlFor="workspace-access-password">
                            Workspace password
                          </FieldLabel>
                          <Input
                            aria-describedby={
                              invalid
                                ? "workspace-password-help workspace-access-password-error"
                                : "workspace-password-help"
                            }
                            aria-invalid={invalid}
                            autoComplete="new-password"
                            disabled={isSaving}
                            id="workspace-access-password"
                            onBlur={field.handleBlur}
                            onChange={(event) => {
                              field.handleChange(event.target.value);
                            }}
                            type="password"
                            value={field.state.value}
                          />
                          <p className="text-sm text-muted-foreground" id="workspace-password-help">
                            {hasPassword
                              ? "Leave blank to keep current password."
                              : "Set a password to share with guests (8–128 characters)."}
                          </p>
                          {invalid && (
                            <FormFieldError
                              errors={field.state.meta.errors}
                              id="workspace-access-password-error"
                            />
                          )}
                        </Field>
                      );
                    }}
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
        </form>
      </DialogContent>
    </Dialog>
  );
};

export { WorkspaceVisibilityDialog };
