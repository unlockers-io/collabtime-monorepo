"use client";

import { useAuthForm } from "@repo/auth/form";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { signIn } from "@/lib/auth-client";

const loginSchema = z.object({
  email: z.email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const LoginPage = () => {
  const router = useRouter();
  const { form, isLoading, rootError } = useAuthForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async (values) => {
      const result = await signIn.email({
        email: values.email,
        password: values.password,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Failed to sign in");
      }
      router.push("/");
      router.refresh();
    },
    schema: loginSchema,
  });

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your account to continue</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field name="email">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      aria-invalid={isInvalid}
                      autoComplete="email"
                      disabled={isLoading}
                      id="email"
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="m@example.com"
                      type="email"
                      value={field.state.value}
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="password">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <div className="flex items-center">
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      <Link
                        className="ml-auto text-sm text-foreground underline underline-offset-4"
                        href="/recover"
                      >
                        Forgot your password?
                      </Link>
                    </div>
                    <Input
                      aria-invalid={isInvalid}
                      autoComplete="current-password"
                      disabled={isLoading}
                      id="password"
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      type="password"
                      value={field.state.value}
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </form.Field>

            {rootError && (
              <Field data-invalid>
                <FieldError>{rootError}</FieldError>
              </Field>
            )}

            <Field>
              <Button disabled={isLoading} type="submit">
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
              <FieldDescription className="text-center">
                Don&apos;t have an account?{" "}
                <Link className="text-foreground underline underline-offset-4" href="/signup">
                  Sign up
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
};

export default LoginPage;
