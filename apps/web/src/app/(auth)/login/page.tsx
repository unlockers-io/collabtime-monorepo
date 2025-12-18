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
    } catch {
      toast.error("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md p-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Sign in to your account to continue
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
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
            <p className="text-xs text-red-500">
              {formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
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
            <p className="text-xs text-red-500">
              {formState.errors.password.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isLoading || !formState.isValid}
          className="mt-2 w-full"
        >
          {isLoading ? (
            <>
              <Spinner className="mr-2" />
              Signing in...
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-neutral-900 hover:underline dark:text-neutral-100"
        >
          Sign up
        </Link>
      </div>
    </Card>
  );
};

export default LoginPage;
