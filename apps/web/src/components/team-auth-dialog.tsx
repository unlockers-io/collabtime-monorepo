"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import type { TeamRole } from "@/types";
import { authenticateTeam } from "@/lib/actions";
import { PasswordSchema } from "@/lib/validation";
import { Button, Input, Spinner } from "@repo/ui";
import { Field, FieldError, FieldLabel } from "@/components/field";

type TeamAuthDialogProps = {
  open: boolean;
  teamId: string;
  onAuthenticated: (data: { token: string; role: TeamRole }) => void;
};

const formSchema = z.object({
  password: PasswordSchema,
});

type FormValues = z.infer<typeof formSchema>;

const TeamAuthDialog = ({ open, teamId, onAuthenticated }: TeamAuthDialogProps) => {
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      password: "",
    },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await authenticateTeam(teamId, values.password);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      onAuthenticated({
        token: result.data.token,
        role: result.data.role,
      });
    });
  };

  if (!open) return null;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-2">
            <h1 className="flex items-center gap-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 dark:bg-neutral-100">
                <Lock className="h-5 w-5 text-white dark:text-neutral-900" />
              </div>
              Enter workspace password
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Ask the workspace admin for either the admin password (full access) or
              the member password (view only).
            </p>
          </div>

          <div className="py-4">
            <Controller
              control={form.control}
              name="password"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="team-password">Password</FieldLabel>
                  <Input
                    {...field}
                    id="team-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={isPending || !form.formState.isValid}>
              {isPending ? (
                <>
                  <Spinner className="mr-2" />
                  Checking…
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export { TeamAuthDialog };
