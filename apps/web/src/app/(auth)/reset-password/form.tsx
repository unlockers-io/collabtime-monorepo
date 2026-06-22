"use client";
// React Compiler todo: BuildHIR doesn't yet support ThrowStatement inside try/catch — compiler limitation, not a code bug.
"use no memo";

import { Button } from "@repo/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { toast } from "@repo/ui/components/sonner";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { authClient } from "@/lib/auth-client";
import { resetPasswordSchema } from "@/lib/form-schemas";

const ResetPasswordForm = () => {
  const { push } = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    defaultValues: { confirmPassword: "", password: "" },
    onSubmit: ({ value }) => {
      startTransition(async () => {
        try {
          if (!token) {
            throw new Error("Invalid reset token. Please request a new password reset.");
          }
          const result = await authClient.resetPassword({
            newPassword: value.password,
            token,
          });
          if (result.error) {
            throw new Error(result.error.message ?? "Failed to reset password");
          }
          push("/login?message=password-reset-success");
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "An error occurred. Please try again.";
          toast.error(message);
        }
      });
    },
    validators: { onSubmit: resetPasswordSchema },
  });

  return (
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
                  aria-describedby={isInvalid ? "reset-password-error" : undefined}
                  aria-invalid={isInvalid}
                  autoComplete="new-password"
                  disabled={isPending}
                  id="reset-password"
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  type="password"
                  value={field.state.value}
                />
                {isInvalid && (
                  <FieldError errors={field.state.meta.errors} id="reset-password-error" />
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
                  disabled={isPending}
                  id="reset-confirm-password"
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  type="password"
                  value={field.state.value}
                />
                {isInvalid && (
                  <FieldError errors={field.state.meta.errors} id="reset-confirm-password-error" />
                )}
              </Field>
            );
          }}
        </form.Field>

        <Field>
          <Button aria-busy={isPending} disabled={isPending} type="submit">
            {isPending ? "Resetting…" : "Reset password"}
          </Button>
          <FieldDescription className="text-center">
            Back to{" "}
            <Link className="text-foreground underline underline-offset-4" href="/login">
              sign in
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
};

export default ResetPasswordForm;
