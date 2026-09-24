"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useState, useTransition } from "react";

import { authClient } from "@/lib/auth-client";
import { recoverSchema } from "@/lib/form-schemas";

import { AuthErrorNotice, authErrorKind } from "../auth-error";
import type { AuthErrorKind } from "../auth-error";
import { AUTH_LINK_CLASS, AuthConfirmation, AuthFooter } from "../auth-shell";

const RecoverForm = () => {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<AuthErrorKind | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: ({ value }) => {
      // Clearing first re-inserts the alert, so a repeated failure is announced again.
      setErrorKind(null);
      startTransition(async () => {
        try {
          const result = await authClient.requestPasswordReset({
            email: value.email,
            redirectTo: `${window.location.origin}/reset-password`,
          });
          if (result.error) {
            setErrorKind(authErrorKind(result.error));
            return;
          }
          setSubmittedEmail(value.email);
        } catch {
          setErrorKind("unknown");
        }
      });
    },
    validators: { onSubmit: recoverSchema },
  });

  if (submittedEmail !== null && submittedEmail !== "") {
    return (
      <>
        <AuthConfirmation title="Check your email">
          If <span className="font-medium text-foreground">{submittedEmail}</span> matches an
          account, we&apos;ve sent a link to reset your password.
        </AuthConfirmation>
        <AuthFooter>
          Back to{" "}
          <Link className={AUTH_LINK_CLASS} href="/login">
            sign in
          </Link>
        </AuthFooter>
      </>
    );
  }

  return (
    <>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.Field name="email">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid || undefined}>
                  <FieldLabel htmlFor="recover-email">Email</FieldLabel>
                  <Input
                    aria-describedby={isInvalid ? "recover-email-error" : undefined}
                    aria-invalid={isInvalid}
                    autoComplete="email"
                    className="h-11 sm:h-10"
                    disabled={isPending}
                    id="recover-email"
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                    }}
                    placeholder="you@example.com"
                    type="email"
                    value={field.state.value}
                  />
                  {isInvalid && (
                    <FormFieldError errors={field.state.meta.errors} id="recover-email-error" />
                  )}
                </Field>
              );
            }}
          </form.Field>

          {errorKind !== null && <AuthErrorNotice kind={errorKind} />}

          <Button
            aria-busy={isPending}
            className="h-11 w-full sm:h-10"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Sending…" : "Send reset link"}
          </Button>
        </FieldGroup>
      </form>

      <AuthFooter>
        Remembered your password?{" "}
        <Link className={AUTH_LINK_CLASS} href="/login">
          Sign in
        </Link>
      </AuthFooter>
    </>
  );
};

export default RecoverForm;
