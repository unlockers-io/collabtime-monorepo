"use client";

import { Button, buttonVariants } from "@repo/ui/components/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { toast } from "@repo/ui/components/sonner";
import { Spinner } from "@repo/ui/components/spinner";
import { cn } from "@repo/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import { Lock, LogIn, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

const passwordSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

type PrivateSpaceGateProps = {
  isAuthenticated: boolean;
  spaceId: string;
  teamId: string;
};

const PrivateSpaceGate = ({ isAuthenticated, spaceId, teamId }: PrivateSpaceGateProps) => {
  const { refresh } = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  // After correct password from a signed-out visitor: cookie is set but membership isn't yet.
  const [accepted, setAccepted] = useState(false);

  const redirectTarget = `/${teamId}`;
  const withRedirect = (path: string) => `${path}?redirect=${encodeURIComponent(redirectTarget)}`;

  const form = useForm({
    defaultValues: { password: "" },
    onSubmit: async ({ value }) => {
      setServerError(null);
      setIsPending(true);

      // No try/catch: TryStatement bails the React Compiler out of memoizing this component.
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

      // Signed-in visitor: route created membership; reload into the team.
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
    <main className="flex min-h-dvh w-full items-center justify-center px-4 py-12" id="main">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Lock aria-hidden className="size-5 text-muted-foreground" />
          </span>
          <h1 className="text-base font-semibold tracking-tight">Private team</h1>
          <p className="text-sm text-muted-foreground">
            {accepted
              ? "Password accepted. Sign up or log in to join this team so it stays in your list."
              : "Enter the team password to continue."}
          </p>
        </div>

        {accepted ? (
          <div className="flex flex-col gap-2">
            <Link className={cn(buttonVariants())} href={withRedirect("/signup")}>
              <UserPlus aria-hidden className="mr-2 size-4" />
              Sign up to join
            </Link>
            <Link
              className={cn(buttonVariants({ variant: "outline" }))}
              href={withRedirect("/login")}
            >
              <LogIn aria-hidden className="mr-2 size-4" />
              Log in to join
            </Link>
            <button
              className="mt-1 text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              onClick={() => {
                refresh();
              }}
              type="button"
            >
              Continue as guest
            </button>
          </div>
        ) : (
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
                        <FieldError errors={[serverError]} />
                      ) : (
                        isInvalid && <FieldError errors={field.state.meta.errors} />
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
        )}
      </div>
    </main>
  );
};

export { PrivateSpaceGate };
