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
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { signIn } from "@/lib/auth-client";
import { loginSchema } from "@/lib/form-schemas";
import { safeRedirectPath } from "@/lib/redirect-validation";

const LoginForm = () => {
  const { push, refresh } = useRouter();
  const searchParams = useSearchParams();
  // Workspace pages send logged-out users here with ?redirect=/<teamId>;
  // validate it once and use it as both the post-sign-in destination and
  // the signup cross-link context. Invalid or absent → "/".
  const redirect = safeRedirectPath(searchParams.get("redirect"));
  const [isPending, startTransition] = useTransition();
  const [showUnverifiedNotice, setShowUnverifiedNotice] = useState(false);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: ({ value }) => {
      setShowUnverifiedNotice(false);
      startTransition(async () => {
        try {
          const result = await signIn.email({
            email: value.email,
            password: value.password,
          });
          if (result.error) {
            // Better Auth 403s unverified accounts and (sendOnSignIn) re-sends
            // the verification link — informational, not a credentials error.
            if (result.error.code === "EMAIL_NOT_VERIFIED") {
              setShowUnverifiedNotice(true);
              return;
            }
            toast.error(result.error.message ?? "Failed to sign in");
            return;
          }
          push(redirect);
          refresh();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "An error occurred. Please try again.";
          toast.error(message);
        }
      });
    },
    validators: { onSubmit: loginSchema },
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
        <form.Field name="email">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid || undefined}>
                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                <Input
                  aria-describedby={isInvalid ? "login-email-error" : undefined}
                  aria-invalid={isInvalid}
                  autoComplete="email"
                  disabled={isPending}
                  id="login-email"
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="m@example.com"
                  type="email"
                  value={field.state.value}
                />
                {isInvalid && (
                  <FieldError errors={field.state.meta.errors} id="login-email-error" />
                )}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="password">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid || undefined}>
                <div className="flex items-center">
                  <FieldLabel htmlFor="login-password">Password</FieldLabel>
                  <Link
                    className="ml-auto text-sm text-foreground underline underline-offset-4"
                    href="/recover"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  aria-describedby={isInvalid ? "login-password-error" : undefined}
                  aria-invalid={isInvalid}
                  autoComplete="current-password"
                  disabled={isPending}
                  id="login-password"
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  type="password"
                  value={field.state.value}
                />
                {isInvalid && (
                  <FieldError errors={field.state.meta.errors} id="login-password-error" />
                )}
              </Field>
            );
          }}
        </form.Field>

        {showUnverifiedNotice && (
          <output aria-live="polite" className="block text-center text-sm">
            This email isn&apos;t verified yet — we just sent you a new link.
          </output>
        )}

        <Field>
          <Button aria-busy={isPending} disabled={isPending} type="submit">
            {isPending ? "Signing in…" : "Sign in"}
          </Button>
          <FieldDescription className="text-center">
            Don&apos;t have an account?{" "}
            <Link
              className="text-foreground underline underline-offset-4"
              href={
                redirect === "/" ? "/signup" : `/signup?redirect=${encodeURIComponent(redirect)}`
              }
            >
              Sign up
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
};

export default LoginForm;
