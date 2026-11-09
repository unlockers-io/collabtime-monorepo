"use client";

import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { captureException } from "@sentry/nextjs";
import { useState, useTransition } from "react";

import type { AuthErrorKind } from "./auth-error-kind";

const focusInvalidField = ({ formApi }: { formApi: { formId: string } }) => {
  focusFirstInvalidField(formApi.formId);
};

const useAuthSubmit = () => {
  const [isPending, startTransition] = useTransition();
  const [errorKind, setErrorKind] = useState<AuthErrorKind | null>(null);

  const submit = (attempt: () => Promise<AuthErrorKind | null>) => {
    // Clearing first re-inserts the alert, so a repeated failure is announced again.
    setErrorKind(null);
    startTransition(async () => {
      try {
        setErrorKind(await attempt());
      } catch (error) {
        captureException(error);
        setErrorKind("unknown");
      }
    });
  };

  return {
    clearError: () => {
      setErrorKind(null);
    },
    errorKind,
    isPending,
    submit,
  };
};

export { focusInvalidField, useAuthSubmit };
