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
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { signUp } from "@/lib/auth-client";

const signupSchema = z.object({
  email: z.email("Please enter a valid email"),
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

const SignupPage = () => {
  const router = useRouter();
  // Track edits since last submit so stale "user already exists" errors clear
  // as soon as the user changes the email — see useAuthForm: rootError lives
  // inside the hook and only resets on the next submit.
  const [hasEditedSinceSubmit, setHasEditedSinceSubmit] = useState(false);
  const { form, isLoading, rootError } = useAuthForm({
    defaultValues: { email: "", name: "", password: "" },
    onSubmit: async (values) => {
      setHasEditedSinceSubmit(false);
      const result = await signUp.email({
        email: values.email,
        name: values.name,
        password: values.password,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Failed to create account");
      }
      router.push("/");
      router.refresh();
    },
    schema: signupSchema,
  });
  const visibleRootError = hasEditedSinceSubmit ? null : rootError;

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>Enter your details to get started with Collab Time</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field name="name">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <FieldLabel htmlFor="name">Full Name</FieldLabel>
                    <Input
                      aria-invalid={isInvalid}
                      autoComplete="name"
                      disabled={isLoading}
                      id="name"
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="John Doe"
                      type="text"
                      value={field.state.value}
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </form.Field>

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
                      onChange={(e) => {
                        setHasEditedSinceSubmit(true);
                        field.handleChange(e.target.value);
                      }}
                      placeholder="m@example.com"
                      type="email"
                      value={field.state.value}
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="password">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                      aria-invalid={isInvalid}
                      autoComplete="new-password"
                      disabled={isLoading}
                      id="password"
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      type="password"
                      value={field.state.value}
                    />
                    {isInvalid ? (
                      <FieldError errors={field.state.meta.errors} />
                    ) : (
                      <FieldDescription>Must be at least 8 characters long.</FieldDescription>
                    )}
                  </Field>
                );
              }}
            </form.Field>

            {visibleRootError && (
              <Field data-invalid>
                <FieldError>{visibleRootError}</FieldError>
              </Field>
            )}

            <Field>
              <form.Subscribe selector={(state) => state.canSubmit}>
                {(canSubmit) => (
                  <Button disabled={isLoading || !canSubmit} type="submit">
                    {isLoading ? "Creating account..." : "Create account"}
                  </Button>
                )}
              </form.Subscribe>
              <FieldDescription className="text-center">
                Already have an account?{" "}
                <Link className="text-foreground underline underline-offset-4" href="/login">
                  Sign in
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
};

export default SignupPage;
