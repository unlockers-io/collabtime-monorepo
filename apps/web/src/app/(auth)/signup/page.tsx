"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { signUp } from "@/lib/auth-client";
import {
  Button,
  Input,
  Label,
  Card,
  Spinner,
} from "@repo/ui";

const signupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  email: z.string().email("Please enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

const SignupPage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const { handleSubmit, control, formState } = form;

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);

    try {
      const result = await signUp.email({
        name: data.name,
        email: data.email,
        password: data.password,
      });

      if (result.error) {
        toast.error(result.error.message ?? "Failed to create account");
        setIsLoading(false);
        return;
      }

      toast.success("Account created successfully!");
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
          Create your account
        </h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Get started with Collab Time for free
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Input
                  {...field}
                  id="name"
                  type="text"
                  placeholder="Your name"
                  className="pl-10"
                  autoComplete="name"
                  aria-invalid={formState.errors.name ? "true" : "false"}
                />
              )}
            />
          </div>
          {formState.errors.name && (
            <p className="text-xs text-red-500">
              {formState.errors.name.message}
            </p>
          )}
        </div>

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
                  placeholder="At least 8 characters"
                  className="pl-10"
                  autoComplete="new-password"
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
              Creating account...
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
        By creating an account, you agree to our terms of service and privacy
        policy.
      </p>

      <div className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-neutral-900 hover:underline dark:text-neutral-100"
        >
          Sign in
        </Link>
      </div>
    </Card>
  );
};

export default SignupPage;
