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

import { signIn } from "@/lib/auth-client";
import { loginSchema } from "@/lib/form-schemas";

const LoginForm = () => {
  const { push, refresh } = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: ({ value }) => {
      startTransition(async () => {
        try {
          const result = await signIn.email({
            email: value.email,
            password: value.password,
          });
          if (result.error) {
            throw new Error(result.error.message ?? "Failed to sign in");
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

        <Field>
          <Button aria-busy={isPending} disabled={isPending} type="submit">
            {isPending ? "Signing in…" : "Sign in"}
          </Button>
          <FieldDescription className="text-center">
            Don&apos;t have an account?{" "}
            <Link className="text-foreground underline underline-offset-4" href="/signup">
              Sign up
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
};

export default LoginForm;
