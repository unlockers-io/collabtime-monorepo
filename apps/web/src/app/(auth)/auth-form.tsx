"use client";

import { Button } from "@repo/ui/components/button";
import { FieldGroup } from "@repo/ui/components/field";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import type { ComponentProps, ReactNode } from "react";

type AuthFormProps = {
  alert: ComponentProps<typeof FormAlert>["message"];
  children: ReactNode;
  form: { formId: string; handleSubmit: () => Promise<void> };
  isPending: boolean;
  pendingLabel: string;
  submitLabel: string;
};

const AuthForm = ({
  alert,
  children,
  form,
  isPending,
  pendingLabel,
  submitLabel,
}: AuthFormProps) => (
  <ClientReadyForm
    id={form.formId}
    noValidate
    onSubmit={(e) => {
      e.preventDefault();
      e.stopPropagation();
      void form.handleSubmit();
    }}
  >
    <FieldGroup>
      <FormAlert message={alert} />
      {children}
      <Button
        aria-busy={isPending}
        className="h-11 w-full sm:h-10"
        disabled={isPending}
        type="submit"
      >
        {isPending ? pendingLabel : submitLabel}
      </Button>
    </FieldGroup>
  </ClientReadyForm>
);

export { AuthForm };
