"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { captureException } from "@sentry/nextjs";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { PageHeader } from "@/components/page-header";
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
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { name: user.name },
    listeners: {
      onChange: () => {
        setFormError(null);
      },
    },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();
      if (name === user.name) {
        return;
      }
      const result = await saveName(name);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      toast.success("Name updated");
      onSaved();
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: profileSchema },
  });

  return (
    <>
      <PageHeader description="Manage the account you use to sign in." title="Settings" />

      <SectionCard>
        <SectionCardHeader>
          <SectionCardTitle description="Your name and sign-in email.">Profile</SectionCardTitle>
        </SectionCardHeader>

        <ClientReadyForm
          className="flex max-w-xl flex-col gap-6"
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
            <form.Field name="name">
              {(field) => {
                const isInvalid = !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <FieldLabel htmlFor={nameId}>Full name</FieldLabel>
                    <Input
                      aria-describedby={
                        isInvalid ? `${nameId}-hint ${nameId}-error` : `${nameId}-hint`
                      }
                      aria-invalid={isInvalid}
                      autoComplete="name"
                      id={nameId}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                      }}
                      placeholder="Your name"
                      value={field.state.value}
                    />
                    <FieldDescription id={`${nameId}-hint`}>Up to 100 characters.</FieldDescription>
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
              isSubmitting: state.isSubmitting,
              name: state.values.name.trim(),
            })}
          >
            {({ isSubmitting, name }) => (
              <div>
                <Button disabled={isSubmitting || name === "" || name === user.name} type="submit">
                  {isSubmitting ? "Saving…" : "Save changes"}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </ClientReadyForm>
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
