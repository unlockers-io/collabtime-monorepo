"use client";

import { Button, buttonVariants } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { cn } from "@repo/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { authClient } from "@/lib/auth-client";
import { resetPasswordSchema } from "@/lib/form-schemas";

import { AuthErrorNotice } from "../auth-error";
import { authErrorKind } from "../auth-error-kind";
import type { AuthErrorKind } from "../auth-error-kind";
import { AUTH_LINK_CLASS, AuthFooter, FormNotice } from "../auth-shell";

const BackToSignIn = () => (
  <AuthFooter>
    Back to{" "}
    <Link className={AUTH_LINK_CLASS} href="/login">
      sign in
    </Link>
  </AuthFooter>
);

const NewPasswordForm = ({ token }: { token: string }) => {
  const { push } = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorKind, setErrorKind] = useState<AuthErrorKind | null>(null);

  const form = useForm({
    defaultValues: { confirmPassword: "", password: "" },
    onSubmit: ({ value }) => {
      // Clearing first re-inserts the alert, so a repeated failure is announced again.
      setErrorKind(null);
      startTransition(async () => {
        try {
          const result = await authClient.resetPassword({
            newPassword: value.password,
            token,
          });
          if (result.error) {
            setErrorKind(authErrorKind(result.error));
            return;
          }
          push("/login?message=password-reset-success");
        } catch {
          setErrorKind("unknown");
        }
      });
    },
    validators: { onSubmit: resetPasswordSchema },
  });

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
          <form.Field name="password">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid || undefined}>
                  <FieldLabel htmlFor="reset-password">New password</FieldLabel>
                  <Input
                    aria-describedby={isInvalid ? "reset-password-error" : "reset-password-hint"}
                    aria-invalid={isInvalid}
                    autoComplete="new-password"
                    className="h-11 sm:h-10"
                    disabled={isPending}
                    id="reset-password"
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                    }}
                    type="password"
                    value={field.state.value}
                  />
                  {isInvalid ? (
                    <FormFieldError errors={field.state.meta.errors} id="reset-password-error" />
                  ) : (
                    <FieldDescription id="reset-password-hint">
                      Must be at least 12 characters long.
                    </FieldDescription>
                  )}
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid || undefined}>
                  <FieldLabel htmlFor="reset-confirm-password">Confirm password</FieldLabel>
                  <Input
                    aria-describedby={isInvalid ? "reset-confirm-password-error" : undefined}
                    aria-invalid={isInvalid}
                    autoComplete="new-password"
                    className="h-11 sm:h-10"
                    disabled={isPending}
                    id="reset-confirm-password"
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                    }}
                    type="password"
                    value={field.state.value}
                  />
                  {isInvalid && (
                    <FormFieldError
                      errors={field.state.meta.errors}
                      id="reset-confirm-password-error"
                    />
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
            {isPending ? "Resetting…" : "Reset password"}
          </Button>
        </FieldGroup>
      </form>

      <BackToSignIn />
    </>
  );
};

const ResetPasswordForm = () => {
  const token = useSearchParams().get("token");

  if (token === null || token === "") {
    return (
      <>
        <div className="flex flex-col gap-6">
          <FormNotice tone="neutral">
            This reset link is incomplete or has expired. Request a new one to continue.
          </FormNotice>
          <Link className={cn(buttonVariants(), "h-11 w-full sm:h-10")} href="/recover">
            Request a new reset link
          </Link>
        </div>
        <BackToSignIn />
      </>
    );
  }

  return <NewPasswordForm token={token} />;
};

export default ResetPasswordForm;
