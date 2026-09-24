"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, use, useState, useTransition } from "react";

import { signUp } from "@/lib/auth-client";
import { signupSchema } from "@/lib/form-schemas";
import { safeRedirectPath } from "@/lib/redirect-validation";

import { AuthErrorNotice, authErrorKind } from "../auth-error";
import type { AuthErrorKind } from "../auth-error";
import { AUTH_LINK_CLASS, AuthConfirmation, AuthFooter } from "../auth-shell";

type Props = {
  searchParams: Promise<{ redirect?: string }>;
};

const SignInLinkFallback = () => (
  <Link className={AUTH_LINK_CLASS} href="/login">
    Sign in
  </Link>
);

const SignInLink = ({ searchParams }: Props) => {
  const { redirect: redirectParam } = use(searchParams);
  const redirect = safeRedirectPath(redirectParam);

  return (
    <Link
      className={AUTH_LINK_CLASS}
      href={redirect === "/" ? "/login" : `/login?redirect=${encodeURIComponent(redirect)}`}
    >
      Sign in
    </Link>
  );
};

const RegisterForm = ({ searchParams }: Props) => {
  const { push, refresh } = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<AuthErrorKind | null>(null);

  const form = useForm({
    defaultValues: { email: "", name: "", password: "" },
    onSubmit: ({ value }) => {
      // Clearing first re-inserts the alert, so a repeated failure is announced again.
      setErrorKind(null);
      startTransition(async () => {
        try {
          const { redirect: redirectParam } = await searchParams;
          const redirect = safeRedirectPath(redirectParam);
          const result = await signUp.email({
            callbackURL: redirect,
            email: value.email,
            name: value.name,
            password: value.password,
          });
          if (result.error) {
            setErrorKind(authErrorKind(result.error));
            return;
          }
          const sessionToken = result.data?.token;
          if (typeof sessionToken !== "string" || sessionToken === "") {
            setSentToEmail(value.email);
            return;
          }
          push(redirect);
          refresh();
        } catch {
          setErrorKind("unknown");
        }
      });
    },
    validators: { onSubmit: signupSchema },
  });

  if (sentToEmail !== null && sentToEmail !== "") {
    return (
      <AuthConfirmation title="Check your email">
        We sent a verification link to{" "}
        <span className="font-medium text-foreground">{sentToEmail}</span>. Open it to verify your
        account and sign in.
      </AuthConfirmation>
    );
  }

  const signInLink = (
    <Suspense fallback={<SignInLinkFallback />}>
      <SignInLink searchParams={searchParams} />
    </Suspense>
  );

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
          <form.Field name="name">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid || undefined}>
                  <FieldLabel htmlFor="register-name">Full name</FieldLabel>
                  <Input
                    aria-describedby={isInvalid ? "register-name-error" : undefined}
                    aria-invalid={isInvalid}
                    autoComplete="name"
                    className="h-11 sm:h-10"
                    disabled={isPending}
                    id="register-name"
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                    }}
                    type="text"
                    value={field.state.value}
                  />
                  {isInvalid && (
                    <FormFieldError errors={field.state.meta.errors} id="register-name-error" />
                  )}
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="email">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid || undefined}>
                  <FieldLabel htmlFor="register-email">Email</FieldLabel>
                  <Input
                    aria-describedby={isInvalid ? "register-email-error" : undefined}
                    aria-invalid={isInvalid}
                    autoComplete="email"
                    className="h-11 sm:h-10"
                    disabled={isPending}
                    id="register-email"
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                    }}
                    placeholder="you@example.com"
                    type="email"
                    value={field.state.value}
                  />
                  {isInvalid && (
                    <FormFieldError errors={field.state.meta.errors} id="register-email-error" />
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
                  <FieldLabel htmlFor="register-password">Password</FieldLabel>
                  <Input
                    aria-describedby={
                      isInvalid ? "register-password-error" : "register-password-hint"
                    }
                    aria-invalid={isInvalid}
                    autoComplete="new-password"
                    className="h-11 sm:h-10"
                    disabled={isPending}
                    id="register-password"
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                    }}
                    type="password"
                    value={field.state.value}
                  />
                  {isInvalid ? (
                    <FormFieldError errors={field.state.meta.errors} id="register-password-error" />
                  ) : (
                    <FieldDescription id="register-password-hint">
                      Must be at least 12 characters long.
                    </FieldDescription>
                  )}
                </Field>
              );
            }}
          </form.Field>

          {errorKind !== null && <AuthErrorNotice kind={errorKind} signInLink={signInLink} />}

          <Button
            aria-busy={isPending}
            className="h-11 w-full sm:h-10"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Creating account…" : "Create account"}
          </Button>
        </FieldGroup>
      </form>

      <AuthFooter>Already have an account? {signInLink}</AuthFooter>
    </>
  );
};

export default RegisterForm;
