"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { captureException } from "@sentry/nextjs";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { PageHeader } from "@/components/page-layout";
import { SectionCard, SectionCardHeader, SectionCardTitle } from "@/components/section-card";
import type { ActionResult } from "@/lib/actions/types";
import { authClient } from "@/lib/auth-client";

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
});

type SettingsUser = {
  email: string;
  id: string;
  name: string;
};

type SettingsViewProps = {
  onSaved: () => void;
  saveName: (name: string) => Promise<ActionResult<null>>;
  user: SettingsUser;
};

const SettingsView = ({ onSaved, saveName, user }: SettingsViewProps) => {
  const id = useId();
  const nameId = `${id}-name`;
  const emailId = `${id}-email`;

  const form = useForm({
    defaultValues: { name: user.name },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();
      if (name === user.name) {
        return;
      }
      const result = await saveName(name);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Name updated");
      onSaved();
    },
    validators: { onBlur: profileSchema, onChange: profileSchema, onSubmit: profileSchema },
  });

  return (
    <>
      <PageHeader description="Manage the account you use to sign in." title="Settings" />

      <SectionCard>
        <SectionCardHeader>
          <SectionCardTitle description="Your name and sign-in email.">Profile</SectionCardTitle>
        </SectionCardHeader>

        {/* oxlint-disable-next-line react-doctor/no-prevent-default -- TanStack Form + Better Auth client drives submit; JS-off progressive enhancement is N/A */}
        <form
          className="flex max-w-xl flex-col gap-6"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field name="name">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <FieldLabel htmlFor={nameId}>Full name</FieldLabel>
                    <Input
                      aria-describedby={isInvalid ? `${nameId}-error` : undefined}
                      aria-invalid={isInvalid}
                      autoComplete="name"
                      id={nameId}
                      maxLength={100}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                      }}
                      placeholder="Your name"
                      value={field.state.value}
                    />
                    {isInvalid && (
                      <FormFieldError errors={field.state.meta.errors} id={`${nameId}-error`} />
                    )}
                  </Field>
                );
              }}
            </form.Field>

            <Field>
              <FieldLabel htmlFor={emailId}>Email</FieldLabel>
              <Input
                aria-describedby={`${emailId}-hint`}
                disabled
                id={emailId}
                type="email"
                value={user.email}
              />
              <FieldDescription id={`${emailId}-hint`}>
                Your sign-in email can&apos;t be changed.
              </FieldDescription>
            </Field>
          </FieldGroup>

          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
              name: state.values.name,
            })}
          >
            {({ canSubmit, isSubmitting, name }) => (
              <div>
                <Button
                  disabled={!canSubmit || isSubmitting || name.trim() === user.name}
                  type="submit"
                >
                  {isSubmitting ? "Saving…" : "Save changes"}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </SectionCard>
    </>
  );
};

const saveName = async (name: string): Promise<ActionResult<null>> => {
  try {
    const { error } = await authClient.updateUser({ name });
    if (error) {
      captureException(error);
      return { error: error.message ?? "Failed to update name", success: false };
    }
    return { data: null, success: true };
  } catch (error) {
    captureException(error);
    return { error: "Failed to update name", success: false };
  }
};

type SettingsClientProps = {
  user: SettingsUser;
};

const SettingsClient = ({ user }: SettingsClientProps) => {
  const { refresh } = useRouter();
  return <SettingsView onSaved={refresh} saveName={saveName} user={user} />;
};

export { SettingsClient, SettingsView };
