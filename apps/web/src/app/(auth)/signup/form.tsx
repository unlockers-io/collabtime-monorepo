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
import { Suspense, use, useState, useTransition } from "react";

import { signUp } from "@/lib/auth-client";
import { signupSchema } from "@/lib/form-schemas";
import { safeRedirectPath } from "@/lib/redirect-validation";

type Props = {
  searchParams: Promise<{ redirect?: string }>;
};

const SignInLinkFallback = () => (
  <Link className="text-foreground underline underline-offset-4" href="/login">
    Sign in
  </Link>
);

const SignInLink = ({ searchParams }: Props) => {
  const { redirect: redirectParam } = use(searchParams);
  const redirect = safeRedirectPath(redirectParam);

  return (
    <Link
      className="text-foreground underline underline-offset-4"
      href={redirect === "/" ? "/login" : `/login?redirect=${encodeURIComponent(redirect)}`}
    >
      Sign in
    </Link>
  );
};

const SignupForm = ({ searchParams }: Props) => {
  const { push, refresh } = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "", name: "", password: "" },
    onSubmit: ({ value }) => {
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
            toast.error(result.error.message ?? "Failed to create account");
            return;
          }
          // No token: requireEmailVerification suppressed auto-sign-in or enumeration prevention.
          const sessionToken = result.data?.token;
          if (typeof sessionToken !== "string" || sessionToken === "") {
            setSentToEmail(value.email);
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
    validators: { onSubmit: signupSchema },
  });

  if (sentToEmail !== null && sentToEmail !== "") {
    return (
      <output aria-live="polite" className="block space-y-1 text-center">
        <span className="block font-medium">Check your email</span>
        <span className="block text-sm text-muted-foreground">
          We sent a verification link to <span className="font-medium">{sentToEmail}</span>. Click
          it to verify your account and sign in.
        </span>
      </output>
    );
  }

  return (
    // oxlint-disable-next-line react-doctor/no-prevent-default -- TanStack Form + Better Auth client drives submit; JS-off progressive enhancement is N/A
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
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
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
                  onChange={(e) => {
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
                <FieldLabel htmlFor="signup-password">Password</FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  autoComplete="new-password"
                  disabled={isPending}
                  id="signup-password"
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
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
            <Suspense fallback={<SignInLinkFallback />}>
              <SignInLink searchParams={searchParams} />
            </Suspense>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
};

export default SignupForm;
