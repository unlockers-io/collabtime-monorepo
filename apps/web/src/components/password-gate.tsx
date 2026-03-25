"use client";

import { Button, Field, FieldError, FieldLabel, Input, Card, Spinner } from "@repo/ui";
import { useForm } from "@tanstack/react-form";
import { Lock, ArrowRight, Eye, EyeOff, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

type PasswordGateProps = {
  spaceId: string;
  teamName?: string;
};

const passwordSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

const PasswordGate = ({ spaceId, teamName }: PasswordGateProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [isDesktop] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia("(pointer: fine)").matches;
  });

  const form = useForm({
    defaultValues: {
      password: "",
    },
    validators: {
      onBlur: passwordSchema,
      onChange: passwordSchema,
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/spaces/${spaceId}/verify-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: value.password }),
        });

        const result = (await response.json()) as { error?: string };

        if (!response.ok) {
          toast.error(result.error ?? "Incorrect password");
          setIsLoading(false);
          return;
        }

        toast.success("Access granted!");
        router.refresh();
      } catch (error) {
        console.error("[PasswordGate] Failed to verify password:", error);
        toast.error("Failed to verify password");
        setIsLoading(false);
      }
    },
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 pb-16">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <Globe className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {teamName ?? "Protected Team"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">This team is password protected</p>
      </div>

      <Card className="w-full max-w-sm p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <form.Field name="password">
            {(field) => (
              <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
                <FieldLabel htmlFor="password" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Enter Password
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter the access password"
                    className="pr-10"
                    autoFocus={isDesktop}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {field.state.meta.isTouched && !field.state.meta.isValid && (
                  <FieldError errors={field.state.meta.errors} />
                )}
              </Field>
            )}
          </form.Field>

          <form.Subscribe selector={(state) => ({ canSubmit: state.canSubmit })}>
            {({ canSubmit }) => (
              <Button type="submit" disabled={isLoading || !canSubmit} className="w-full">
                {isLoading ? (
                  <>
                    <Spinner className="mr-2" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Access Team
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </form.Subscribe>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Contact the team owner if you don&apos;t have the password.
        </p>
      </Card>
    </div>
  );
};

export { PasswordGate };
