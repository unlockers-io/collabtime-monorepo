"use client";

import { Button, Field, FieldError, FieldLabel, Input, Card, Spinner } from "@repo/ui";
import { useForm } from "@tanstack/react-form";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, ViewTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { TransitionLink } from "@/components/transition-link";
import { signIn } from "@/lib/auth-client";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginPage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const defaultValues: LoginFormValues = {
    email: "",
    password: "",
  };

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true);

      try {
        const result = await signIn.email({
          email: value.email,
          password: value.password,
        });

        if (result.error) {
          toast.error(result.error.message ?? "Failed to sign in");
          setIsLoading(false);
          return;
        }

        toast.success("Welcome back!");
        router.push("/");
        router.refresh();
      } catch (error) {
        console.error("[Login] Unexpected error:", error);
        toast.error("An unexpected error occurred");
        setIsLoading(false);
      }
    },
  });

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      <Card className="max-w-md p-8 w-full">
        <div className="gap-8 flex flex-col">
          <div className="gap-2 flex flex-col text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="gap-4 flex flex-col"
            noValidate
          >
            <form.Field name="email">
              {(field) => (
                <Field data-invalid={!field.state.meta.isValid}>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <div className="relative">
                    <Mail className="left-3 h-4 w-4 absolute top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10"
                      autoComplete="email"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={!field.state.meta.isValid}
                    />
                  </div>
                  {!field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <Field data-invalid={!field.state.meta.isValid}>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <div className="relative">
                    <Lock className="left-3 h-4 w-4 absolute top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Your password"
                      className="pl-10"
                      autoComplete="current-password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={!field.state.meta.isValid}
                    />
                  </div>
                  {!field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )}
            </form.Field>

            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit }) => (
                <Button type="submit" disabled={isLoading || !canSubmit} className="w-full">
                  {isLoading ? (
                    <span className="gap-2 flex items-center">
                      <Spinner />
                      Signing in...
                    </span>
                  ) : (
                    <span className="gap-2 flex items-center">
                      Sign in
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              )}
            </form.Subscribe>
          </form>

          <div className="text-sm text-center text-muted-foreground">
            Don&apos;t have an account?{" "}
            <TransitionLink
              href="/signup"
              transitionType="nav-forward"
              className="font-medium text-foreground hover:underline"
            >
              Sign up
            </TransitionLink>
          </div>
        </div>
      </Card>
    </ViewTransition>
  );
};

export default LoginPage;
