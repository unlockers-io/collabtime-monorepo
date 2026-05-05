"use client";

import { useAuthForm } from "@repo/auth/form";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";

const recoverSchema = z.object({
  email: z.email("Please enter a valid email"),
});

const RecoverPage = () => {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const { form, isLoading, rootError } = useAuthForm({
    defaultValues: { email: "" },
    onSubmit: async (values) => {
      const result = await authClient.requestPasswordReset({
        email: values.email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Failed to send password reset email");
      }
      setSubmittedEmail(values.email);
    },
    schema: recoverSchema,
  });

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Recover your account</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a link to reset your password
        </CardDescription>
      </CardHeader>
      <CardContent>
        {submittedEmail ? (
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
        ) : (
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
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <Input
                        aria-invalid={isInvalid}
                        autoComplete="email"
                        disabled={isLoading}
                        id="email"
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="m@example.com"
                        type="email"
                        value={field.state.value}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              </form.Field>

              {rootError && (
                <Field data-invalid>
                  <FieldError>{rootError}</FieldError>
                </Field>
              )}

              <Field>
                <form.Subscribe selector={(state) => state.canSubmit}>
                  {(canSubmit) => (
                    <Button disabled={isLoading || !canSubmit} type="submit">
                      {isLoading ? "Sending..." : "Send reset link"}
                    </Button>
                  )}
                </form.Subscribe>
                <FieldDescription className="text-center">
                  Remembered your password?{" "}
                  <Link className="text-foreground underline underline-offset-4" href="/login">
                    Sign in
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default RecoverPage;
