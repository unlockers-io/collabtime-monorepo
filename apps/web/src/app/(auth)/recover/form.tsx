"use client";
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
import { useState, useTransition } from "react";

import { authClient } from "@/lib/auth-client";
import { recoverSchema } from "@/lib/form-schemas";

const RecoverForm = () => {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: ({ value }) => {
      startTransition(async () => {
        try {
          const result = await authClient.requestPasswordReset({
            email: value.email,
            redirectTo: `${window.location.origin}/reset-password`,
          });
          if (result.error) {
            throw new Error(result.error.message ?? "Failed to send password reset email");
          }
          setSubmittedEmail(value.email);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "An error occurred. Please try again.";
          toast.error(message);
        }
      });
    },
    validators: { onSubmit: recoverSchema },
  });

  if (submittedEmail) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-semibold">Check your email</p>
        <p className="text-sm text-muted-foreground">
          If <span className="font-medium text-foreground">{submittedEmail}</span> matches an
          account, we&apos;ve sent a link to reset your password.
        </p>
        <p className="text-sm text-muted-foreground">
          Back to{" "}
          <Link className="text-foreground underline underline-offset-4" href="/login">
            sign in
          </Link>
          .
        </p>
      </div>
    );
  }

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
                  disabled={isPending}
                  id="recover-email"
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="m@example.com"
                  type="email"
                  value={field.state.value}
                />
                {isInvalid && (
                  <FieldError errors={field.state.meta.errors} id="recover-email-error" />
                )}
              </Field>
            );
          }}
        </form.Field>

        <Field>
          <Button aria-busy={isPending} disabled={isPending} type="submit">
            {isPending ? "Sending…" : "Send reset link"}
          </Button>
          <FieldDescription className="text-center">
            Remembered your password?{" "}
            <Link className="text-foreground underline underline-offset-4" href="/login">
              Sign in
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
};

export default RecoverForm;
