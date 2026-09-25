"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, use, useState, useTransition } from "react";

import { signIn } from "@/lib/auth-client";
import { loginSchema } from "@/lib/form-schemas";
import { safeRedirectPath } from "@/lib/redirect-validation";

import { AuthErrorNotice } from "../auth-error";
import { authErrorKind } from "../auth-error-kind";
import type { AuthErrorKind } from "../auth-error-kind";
import { AUTH_LINK_CLASS, AuthFooter, FormNotice } from "../auth-shell";

type Props = {
  searchParams: Promise<{ redirect?: string }>;
};

const SignUpLinkFallback = () => (
  <Link className={AUTH_LINK_CLASS} href="/register">
    Sign up
  </Link>
);

const SignUpLink = ({ searchParams }: Props) => {
  const { redirect: redirectParam } = use(searchParams);
  const redirect = safeRedirectPath(redirectParam);

  return (
    <Link
      className={AUTH_LINK_CLASS}
      href={redirect === "/" ? "/register" : `/register?redirect=${encodeURIComponent(redirect)}`}
    >
      Sign up
    </Link>
  );
};

const LoginForm = ({ searchParams }: Props) => {
  const { push, refresh } = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showUnverifiedNotice, setShowUnverifiedNotice] = useState(false);
  const [errorKind, setErrorKind] = useState<AuthErrorKind | null>(null);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: ({ value }) => {
      setShowUnverifiedNotice(false);
      // Clearing first re-inserts the alert, so a repeated failure is announced again.
      setErrorKind(null);
      startTransition(async () => {
        try {
          const { redirect: redirectParam } = await searchParams;
          const result = await signIn.email({
            email: value.email,
            password: value.password,
          });
          if (result.error) {
            if (result.error.code === "EMAIL_NOT_VERIFIED") {
              setShowUnverifiedNotice(true);
              return;
            }
            setErrorKind(authErrorKind(result.error));
            return;
          }
          push(safeRedirectPath(redirectParam));
          refresh();
        } catch {
          setErrorKind("unknown");
        }
      });
    },
    validators: { onSubmit: loginSchema },
  });

  return (
    <>
      {/* oxlint-disable-next-line react-doctor/no-prevent-default -- TanStack Form + Better Auth client drives submit; JS-off progressive enhancement is N/A */}
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
                    className="h-11 sm:h-10"
                    disabled={isPending}
                    id="login-email"
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                    }}
                    placeholder="you@example.com"
                    type="email"
                    value={field.state.value}
                  />
                  {isInvalid && (
                    <FormFieldError errors={field.state.meta.errors} id="login-email-error" />
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
                  <div className="flex items-baseline justify-between gap-3">
                    <FieldLabel htmlFor="login-password">Password</FieldLabel>
                    <Link
                      className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      href="/recover"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                  <Input
                    aria-describedby={isInvalid ? "login-password-error" : undefined}
                    aria-invalid={isInvalid}
                    autoComplete="current-password"
                    className="h-11 sm:h-10"
                    disabled={isPending}
                    id="login-password"
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                    }}
                    type="password"
                    value={field.state.value}
                  />
                  {isInvalid && (
                    <FormFieldError errors={field.state.meta.errors} id="login-password-error" />
                  )}
                </Field>
              );
            }}
          </form.Field>

          {showUnverifiedNotice && (
            <FormNotice tone="neutral">
              This email isn&apos;t verified yet. We just sent you a new link.
            </FormNotice>
          )}
          {errorKind !== null && <AuthErrorNotice kind={errorKind} />}

          <Button
            aria-busy={isPending}
            className="h-11 w-full sm:h-10"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Signing in…" : "Sign in"}
          </Button>
        </FieldGroup>
      </form>

      <AuthFooter>
        Don&apos;t have an account?{" "}
        <Suspense fallback={<SignUpLinkFallback />}>
          <SignUpLink searchParams={searchParams} />
        </Suspense>
      </AuthFooter>
    </>
  );
};

export default LoginForm;
