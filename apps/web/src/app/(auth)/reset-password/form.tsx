"use client";

import { buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { TextField } from "@/components/text-field";
import { authClient } from "@/lib/auth-client";
import { bindField } from "@/lib/bind-field";
import { NEW_PASSWORD_HINT, resetPasswordSchema } from "@/lib/form-schemas";

import { authErrorMessage } from "../auth-error";
import { authErrorKind } from "../auth-error-kind";
import { AuthForm } from "../auth-form";
import { AUTH_LINK_CLASS, AuthFooter, FormNotice } from "../auth-shell";
import { PASSWORD_RESET_NOTICE_URL } from "../login/login-notice";
import { focusInvalidField, useAuthSubmit } from "../use-auth-submit";

const BackToSignIn = () => (
  <AuthFooter>
    Back to{" "}
    <Link className={AUTH_LINK_CLASS} href="/login">
      sign in
    </Link>
  </AuthFooter>
);

const NewPasswordForm = ({ token }: { token: string }) => {
  const { push } = useRouter();
  const auth = useAuthSubmit();

  const form = useForm({
    defaultValues: { confirmPassword: "", password: "" },
    listeners: { onChange: auth.clearError },
    onSubmit: ({ value }) => {
      auth.submit(async () => {
        const result = await authClient.resetPassword({ newPassword: value.password, token });

        if (result.error) {
          return authErrorKind(result.error);
        }

        push(PASSWORD_RESET_NOTICE_URL);

        return null;
      });
    },
    onSubmitInvalid: focusInvalidField,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: resetPasswordSchema },
  });

  return (
    <div className="flex flex-col gap-10">
      <AuthForm
        alert={authErrorMessage(auth.errorKind)}
        form={form}
        isPending={auth.isPending}
        pendingLabel="Resetting…"
        submitLabel="Reset password"
      >
        <form.Field name="password">
          {(field) => (
            <TextField
              {...bindField(field)}
              autoComplete="new-password"
              description={NEW_PASSWORD_HINT}
              disabled={auth.isPending}
              id="reset-password"
              label="New password"
              required
              touch
              type="password"
            />
          )}
        </form.Field>

        <form.Field name="confirmPassword">
          {(field) => (
            <TextField
              {...bindField(field)}
              autoComplete="new-password"
              disabled={auth.isPending}
              id="reset-confirm-password"
              label="Confirm password"
              required
              touch
              type="password"
            />
          )}
        </form.Field>
      </AuthForm>

      <BackToSignIn />
    </div>
  );
};

const ResetPasswordForm = () => {
  const token = useSearchParams().get("token");

  if (token === null || token === "") {
    return (
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-6">
          <FormNotice tone="neutral">
            This reset link is incomplete or has expired. Request a new one to continue.
          </FormNotice>
          <Link className={cn(buttonVariants(), "h-11 w-full sm:h-10")} href="/recover">
            Request a new reset link
          </Link>
        </div>
        <BackToSignIn />
      </div>
    );
  }

  return <NewPasswordForm token={token} />;
};

export { NewPasswordForm };

export default ResetPasswordForm;
