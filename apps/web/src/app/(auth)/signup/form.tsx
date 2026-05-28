"use client";

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
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { stashCredentials } from "@/app/(auth)/verify-email/credentials-store";
import { signUp } from "@/lib/auth-client";
import { signupSchema } from "@/lib/form-schemas";

const SignupForm = () => {
  const { push, refresh } = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    defaultValues: { email: "", name: "", password: "" },
    onSubmit: ({ value }) => {
      startTransition(async () => {
        try {
          const result = await signUp.email({
            email: value.email,
            name: value.name,
            password: value.password,
          });
          if (result.error) {
            throw new Error(result.error.message ?? "Failed to create account");
          }
          // requireEmailVerification gates auto-sign-in: when active, Better
          // Auth returns the user without a session token. Hand off email +
          // password (in-memory only — never to storage) to the dedicated
          // /verify-email screen, which polls signIn.email until the user
          // clicks the verification link from their inbox. The branch also
          // covers Better Auth's enumeration-prevention path (existing email
          // → synthetic-success-without-token), since the screen's "check
          // your inbox" wording is correct in both cases.
          if (!result.data?.token) {
            const handoff = stashCredentials({ email: value.email, password: value.password });
            push(`/verify-email?k=${handoff}`);
            return;
          }
          push("/");
          refresh();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "An error occurred. Please try again.";
          toast.error(message);
        }
      });
    },
    validators: { onSubmit: signupSchema },
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
        <form.Field name="name">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid || undefined}>
                <FieldLabel htmlFor="signup-name">Full Name</FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  autoComplete="name"
                  disabled={isPending}
                  id="signup-name"
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
                <FieldLabel htmlFor="signup-email">Email</FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  autoComplete="email"
                  disabled={isPending}
                  id="signup-email"
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

        <form.Field name="password">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid || undefined}>
                <FieldLabel htmlFor="signup-password">Password</FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  autoComplete="new-password"
                  disabled={isPending}
                  id="signup-password"
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

        <Field>
          <Button aria-busy={isPending} disabled={isPending} type="submit">
            {isPending ? "Creating account…" : "Create account"}
          </Button>
          <FieldDescription className="text-center">
            Already have an account?{" "}
            <Link className="text-foreground underline underline-offset-4" href="/login">
              Sign in
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
};

export default SignupForm;
