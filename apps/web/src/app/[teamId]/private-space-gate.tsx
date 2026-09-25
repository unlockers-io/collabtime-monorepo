"use client";

import { Button, buttonVariants } from "@repo/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { cn } from "@repo/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import { Lock, LogIn, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { InviteMismatchNotice } from "./client/invite-mismatch-notice";

const passwordSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

type PrivateSpaceGateProps = {
  inviteMismatch?: { invitedEmailMasked: string };
  isAuthenticated: boolean;
  returnTo?: string;
  spaceId: string;
  teamId: string;
};

const PrivateSpaceGate = ({
  inviteMismatch,
  isAuthenticated,
  returnTo,
  spaceId,
  teamId,
}: PrivateSpaceGateProps) => {
  const { refresh } = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const redirectTarget = returnTo ?? `/${teamId}`;
  const withRedirect = (path: string) => `${path}?redirect=${encodeURIComponent(redirectTarget)}`;

  const form = useForm({
    defaultValues: { password: "" },
    onSubmit: async ({ value }) => {
      setServerError(null);
      setIsPending(true);

      const response = await fetch(`/api/spaces/${spaceId}/verify-password`, {
        body: JSON.stringify({ password: value.password }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }).catch(() => null);

      if (!response) {
        toast.error("Could not verify the password. Please try again.");
        setIsPending(false);
        return;
      }
      if (response.status === 401) {
        setServerError("Incorrect password");
        setIsPending(false);
        return;
      }
      if (response.status === 429) {
        toast.error("Too many attempts. Try again later.");
        setIsPending(false);
        return;
      }
      if (!response.ok) {
        toast.error("Could not verify the password. Please try again.");
        setIsPending(false);
        return;
      }

      if (isAuthenticated) {
        refresh();
        return;
      }
      setAccepted(true);
      setIsPending(false);
    },
    validators: { onSubmit: passwordSchema },
  });

  return (
    <main className="flex w-full flex-1 items-start justify-center px-4 py-16 sm:py-24" id="main">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col gap-2">
          <h1 className="flex items-center gap-2 font-display text-3xl font-semibold tracking-hero">
            <Lock aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            Private workspace
          </h1>
          <p className="text-sm text-muted-foreground">
            {accepted
              ? "Password accepted. Create an account or sign in to join, so this workspace stays in your list."
              : "Enter the password you were given to see this team's hours."}
          </p>
        </div>

        {inviteMismatch && <InviteMismatchNotice {...inviteMismatch} returnTo={redirectTarget} />}

        {accepted ? (
          <div className="flex flex-col gap-2">
            <Link className={cn(buttonVariants())} href={withRedirect("/register")}>
              <UserPlus aria-hidden className="mr-2 size-4" />
              Create account to join
            </Link>
            <Link
              className={cn(buttonVariants({ variant: "outline" }))}
              href={withRedirect("/login")}
            >
              <LogIn aria-hidden className="mr-2 size-4" />
              Sign in to join
            </Link>
            <button
              className="mt-1 text-left text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              onClick={() => {
                refresh();
              }}
              type="button"
            >
              Continue as guest
            </button>
          </div>
        ) : (
          <div>
            {!isAuthenticated && (
              <p className="mb-5 text-center text-sm">
                <Link className="underline underline-offset-4" href={withRedirect("/login")}>
                  Sign in
                </Link>
                {" or "}
                <Link className="underline underline-offset-4" href={withRedirect("/register")}>
                  sign up
                </Link>
                {" to accept an invitation or access your workspace."}
              </p>
            )}
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void form.handleSubmit();
              }}
            >
              <FieldGroup>
                <form.Field name="password">
                  {(field) => {
                    const isInvalid =
                      Boolean(serverError) ||
                      (field.state.meta.isTouched && !field.state.meta.isValid);
                    return (
                      <Field data-invalid={isInvalid || undefined}>
                        <FieldLabel htmlFor="space-password">Password</FieldLabel>
                        <Input
                          aria-describedby={isInvalid ? "space-password-error" : undefined}
                          aria-invalid={isInvalid}
                          autoComplete="current-password"
                          disabled={isPending}
                          id="space-password"
                          onBlur={field.handleBlur}
                          onChange={(e) => {
                            setServerError(null);
                            field.handleChange(e.target.value);
                          }}
                          type="password"
                          value={field.state.value}
                        />
                        {serverError !== null && serverError !== "" ? (
                          <FormFieldError errors={[serverError]} id="space-password-error" />
                        ) : (
                          isInvalid && (
                            <FormFieldError
                              errors={field.state.meta.errors}
                              id="space-password-error"
                            />
                          )
                        )}
                      </Field>
                    );
                  }}
                </form.Field>

                <Field>
                  <Button aria-busy={isPending} disabled={isPending} type="submit">
                    {isPending && <Spinner className="mr-2 size-4" />}
                    {isPending ? "Checking…" : "Continue"}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </div>
        )}
      </div>
    </main>
  );
};

export { PrivateSpaceGate };
