"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Lock, ArrowRight, Eye, EyeOff, Globe } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Card,
  Spinner,
} from "@repo/ui";

type PasswordGateProps = {
  spaceId: string;
  teamName?: string;
};

const passwordSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

const PasswordGate = ({ spaceId, teamName }: PasswordGateProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Detect desktop to enable autofocus only on non-touch devices
  // This prevents layout shift from keyboard popup on mobile
  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: fine)");
    setIsDesktop(mediaQuery.matches);
  }, []);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    mode: "onChange",
    defaultValues: {
      password: "",
    },
  });

  const { handleSubmit, control, formState } = form;

  const onSubmit = async (data: PasswordFormValues) => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/spaces/${spaceId}/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: data.password }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error ?? "Incorrect password");
        setIsLoading(false);
        return;
      }

      toast.success("Access granted!");
      router.refresh();
    } catch (err) {
      console.error("[PasswordGate] Failed to verify password:", err);
      toast.error("Failed to verify password");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 pb-16">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <Globe className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {teamName ?? "Protected Team"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This team is password protected
        </p>
      </div>

      <Card className="w-full max-w-sm p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Enter Password
            </Label>
            <div className="relative">
              <Controller
                control={control}
                name="password"
                render={({ field }) => (
                  <Input
                    {...field}
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter the access password"
                    className="pr-10"
                    autoFocus={isDesktop}
                  />
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {formState.errors.password && (
              <p className="text-xs text-red-500">
                {formState.errors.password.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading || !formState.isValid}
            className="w-full"
          >
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
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Contact the team owner if you don&apos;t have the password.
        </p>
      </Card>
    </div>
  );
};

export { PasswordGate };
