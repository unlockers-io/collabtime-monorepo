"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useState } from "react";

import { TextField } from "@/components/text-field";
import { authClient } from "@/lib/auth-client";
import { bindField } from "@/lib/bind-field";
import { recoverSchema } from "@/lib/form-schemas";

import { authErrorMessage } from "../auth-error";
import { authErrorKind } from "../auth-error-kind";
import { AuthForm } from "../auth-form";
import { AUTH_LINK_CLASS, AuthConfirmation, AuthFooter } from "../auth-shell";
import { focusInvalidField, useAuthSubmit } from "../use-auth-submit";

const RecoverForm = () => {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const auth = useAuthSubmit();

  const form = useForm({
    defaultValues: { email: "" },
    listeners: { onChange: auth.clearError },
    onSubmit: ({ value }) => {
      auth.submit(async () => {
        const result = await authClient.requestPasswordReset({
          email: value.email,
          redirectTo: new URL("/reset-password", window.location.origin).toString(),
        });

        if (result.error) {
          return authErrorKind(result.error);
        }

        setSubmittedEmail(value.email);

        return null;
      });
    },
    onSubmitInvalid: focusInvalidField,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: recoverSchema },
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
      <AuthForm
        alert={authErrorMessage(auth.errorKind)}
        form={form}
        isPending={auth.isPending}
        pendingLabel="Sending…"
        submitLabel="Send reset link"
      >
        <form.Field name="email">
          {(field) => (
            <TextField
              {...bindField(field)}
              autoComplete="email"
              disabled={auth.isPending}
              id="recover-email"
              label="Email"
              placeholder="you@example.com"
              required
              touch
              type="email"
            />
          )}
        </form.Field>
      </AuthForm>

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
