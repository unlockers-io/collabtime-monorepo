"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, use, useState } from "react";

import { TextField } from "@/components/text-field";
import { signUp } from "@/lib/auth-client";
import { bindField } from "@/lib/bind-field";
import { ACCOUNT_NAME_HINT, NEW_PASSWORD_HINT, signupSchema } from "@/lib/form-schemas";
import { type RedirectParam, safeRedirectPath, withRedirect } from "@/lib/redirect-validation";

import { authErrorMessage } from "../auth-error";
import { authErrorKind } from "../auth-error-kind";
import { AuthForm } from "../auth-form";
import { AUTH_LINK_CLASS, AuthConfirmation, AuthFooter } from "../auth-shell";
import { focusInvalidField, useAuthSubmit } from "../use-auth-submit";

type Props = {
  searchParams: Promise<{ redirect?: RedirectParam }>;
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
    <Link className={AUTH_LINK_CLASS} href={withRedirect("/login", redirect)}>
      Sign in
    </Link>
  );
};

const RegisterForm = ({ searchParams }: Props) => {
  const { push, refresh } = useRouter();
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const auth = useAuthSubmit();

  const form = useForm({
    defaultValues: { email: "", name: "", password: "" },
    listeners: { onChange: auth.clearError },
    onSubmit: ({ value }) => {
      auth.submit(async () => {
        const { redirect: redirectParam } = await searchParams;
        const redirect = safeRedirectPath(redirectParam);

        const result = await signUp.email({
          callbackURL: redirect,
          email: value.email,
          name: value.name.trim(),
          password: value.password,
        });

        if (result.error) {
          return authErrorKind(result.error);
        }

        const sessionToken = result.data.token;

        if (sessionToken === null || sessionToken === "") {
          setSentToEmail(value.email);

          return null;
        }

        push(redirect);
        refresh();

        return null;
      });
    },
    onSubmitInvalid: focusInvalidField,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: signupSchema },
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
      <AuthForm
        alert={authErrorMessage(auth.errorKind, { signInLink })}
        form={form}
        isPending={auth.isPending}
        pendingLabel="Creating account…"
        submitLabel="Create account"
      >
        <form.Field name="name">
          {(field) => (
            <TextField
              {...bindField(field)}
              autoComplete="name"
              description={ACCOUNT_NAME_HINT}
              disabled={auth.isPending}
              id="register-name"
              label="Full name"
              required
              touch
            />
          )}
        </form.Field>

        <form.Field name="email">
          {(field) => (
            <TextField
              {...bindField(field)}
              autoComplete="email"
              disabled={auth.isPending}
              id="register-email"
              label="Email"
              placeholder="you@example.com"
              required
              touch
              type="email"
            />
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <TextField
              {...bindField(field)}
              autoComplete="new-password"
              description={NEW_PASSWORD_HINT}
              disabled={auth.isPending}
              id="register-password"
              label="Password"
              required
              touch
              type="password"
            />
          )}
        </form.Field>
      </AuthForm>

      <AuthFooter>Already have an account? {signInLink}</AuthFooter>
    </>
  );
};

export default RegisterForm;
