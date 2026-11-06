"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, use, useState } from "react";

import { TextField } from "@/components/text-field";
import { signIn } from "@/lib/auth-client";
import { bindField } from "@/lib/bind-field";
import { loginSchema } from "@/lib/form-schemas";
import { type RedirectParam, safeRedirectPath, withRedirect } from "@/lib/redirect-validation";

import { authErrorMessage } from "../auth-error";
import { authErrorKind } from "../auth-error-kind";
import { AuthForm } from "../auth-form";
import { AUTH_LINK_CLASS, AuthFooter, FormNotice } from "../auth-shell";
import { focusInvalidField, useAuthSubmit } from "../use-auth-submit";

type Props = {
  searchParams: Promise<{ redirect?: RedirectParam }>;
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
    <Link className={AUTH_LINK_CLASS} href={withRedirect("/register", redirect)}>
      Sign up
    </Link>
  );
};

const LoginForm = ({ searchParams }: Props) => {
  const { push, refresh } = useRouter();
  const [showUnverifiedNotice, setShowUnverifiedNotice] = useState(false);
  const auth = useAuthSubmit();

  const form = useForm({
    defaultValues: { email: "", password: "" },
    listeners: {
      onChange: () => {
        setShowUnverifiedNotice(false);
        auth.clearError();
      },
    },
    onSubmit: ({ value }) => {
      setShowUnverifiedNotice(false);
      auth.submit(async () => {
        const [{ redirect: redirectParam }, result] = await Promise.all([
          searchParams,
          signIn.email({ email: value.email, password: value.password }),
        ]);

        if (result.error?.code === "EMAIL_NOT_VERIFIED") {
          setShowUnverifiedNotice(true);

          return null;
        }

        if (result.error) {
          return authErrorKind(result.error);
        }

        push(safeRedirectPath(redirectParam));
        refresh();

        return null;
      });
    },
    onSubmitInvalid: focusInvalidField,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: loginSchema },
  });

  return (
    <>
      <AuthForm
        alert={authErrorMessage(auth.errorKind)}
        form={form}
        isPending={auth.isPending}
        pendingLabel="Signing in…"
        submitLabel="Sign in"
      >
        <form.Field name="email">
          {(field) => (
            <TextField
              {...bindField(field)}
              autoComplete="email"
              disabled={auth.isPending}
              id="login-email"
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
              autoComplete="current-password"
              disabled={auth.isPending}
              id="login-password"
              label="Password"
              labelAside={
                <Link
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  href="/recover"
                >
                  Forgot your password?
                </Link>
              }
              required
              touch
              type="password"
            />
          )}
        </form.Field>

        {showUnverifiedNotice && (
          <FormNotice tone="neutral">
            This email isn&apos;t verified yet. We just sent you a new link.
          </FormNotice>
        )}
      </AuthForm>

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
