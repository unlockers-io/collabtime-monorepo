"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { changeTeamPassword } from "@/lib/actions";
import { PasswordSchema } from "@/lib/validation";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Spinner,
} from "@repo/ui";

type ChangePasswordDialogProps = {
  teamId: string;
  token: string;
  onPasswordChanged: (newToken: string) => void;
};

const formSchema = z
  .object({
    currentPassword: PasswordSchema,
    newPassword: PasswordSchema,
    confirmPassword: PasswordSchema,
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof formSchema>;

const ChangePasswordDialog = ({
  teamId,
  token,
  onPasswordChanged,
}: ChangePasswordDialogProps) => {
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await changeTeamPassword(
        teamId,
        token,
        values.currentPassword,
        values.newPassword,
        values.confirmPassword,
      );

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Password changed successfully");
      onPasswordChanged(result.data.newToken);
      form.reset();
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound className="mr-2 h-4 w-4" />
          Change password
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <KeyRound className="h-5 w-5 text-primary-foreground" />
              </div>
              <DialogTitle>Change admin password</DialogTitle>
            </div>
            <DialogDescription>
              Update the admin password for this team. You&apos;ll need to use
              the new password to unlock admin access in the future.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <Controller
              control={form.control}
              name="currentPassword"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="current-password">
                    Current password
                  </FieldLabel>
                  <Input
                    {...field}
                    id="current-password"
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

            <Controller
              control={form.control}
              name="newPassword"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="new-password">New password</FieldLabel>
                  <Input
                    {...field}
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="confirmPassword"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="confirm-password">
                    Confirm new password
                  </FieldLabel>
                  <Input
                    {...field}
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={isPending || !form.formState.isValid}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  Updating…
                </span>
              ) : (
                "Change password"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export { ChangePasswordDialog };
