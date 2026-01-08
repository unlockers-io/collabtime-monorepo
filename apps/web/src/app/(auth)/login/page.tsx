"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import {
  Button,
  Input,
  Label,
  Card,
  Spinner,
} from "@repo/ui";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginPage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { handleSubmit, control, formState } = form;

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);

    try {
      const result = await signIn.email({
        email: data.email,
        password: data.password,
      });

      if (result.error) {
        toast.error(result.error.message ?? "Failed to sign in");
        setIsLoading(false);
        return;
      }

      toast.success("Welcome back!");
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("[Login] Unexpected error:", err);
      toast.error("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md p-8">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your account to continue
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <Input
                  {...field}
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="pl-10"
                  autoComplete="email"
                  aria-invalid={formState.errors.email ? "true" : "false"}
                />
              )}
            />
          </div>
          {formState.errors.email && (
            <p className="text-xs text-destructive">
              {formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <Input
                  {...field}
                  id="password"
                  type="password"
                  placeholder="Your password"
                  className="pl-10"
                  autoComplete="current-password"
                  aria-invalid={formState.errors.password ? "true" : "false"}
                />
              )}
            />
          </div>
          {formState.errors.password && (
            <p className="text-xs text-destructive">
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
            <span className="flex items-center gap-2">
              <Spinner />
              Signing in...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Sign in
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>

      <div className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground hover:underline"
        >
          Sign up
        </Link>
      </div>
    </div>
    </Card>
  );
};

export default LoginPage;
