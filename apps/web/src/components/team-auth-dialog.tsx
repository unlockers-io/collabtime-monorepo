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
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Spinner,
} from "@repo/ui";

type AdminUnlockDialogProps = {
  open: boolean;
  teamId: string;
  onClose: () => void;
  onAuthenticated: (data: { token: string; role: TeamRole }) => void;
};

const formSchema = z.object({
  password: PasswordSchema,
});

type FormValues = z.infer<typeof formSchema>;

const AdminUnlockDialog = ({
  open,
  teamId,
  onClose,
  onAuthenticated,
}: AdminUnlockDialogProps) => {
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
      form.reset();
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && !isPending) {
      onClose();
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <Lock className="h-5 w-5 text-primary-foreground" />
              </div>
              <DialogTitle>
                Unlock admin access
              </DialogTitle>
            </div>
            <DialogDescription>
              Enter the admin password to add, edit, or remove team members.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Controller
              control={form.control}
              name="password"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="admin-password">
                    Admin password
                  </FieldLabel>
                  <Input
                    {...field}
                    id="admin-password"
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !form.formState.isValid}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  Checking…
                </span>
              ) : (
                "Unlock"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export { AdminUnlockDialog };
