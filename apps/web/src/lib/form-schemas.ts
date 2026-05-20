import { z } from "zod";

const loginSchema = z.object({
  email: z.email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z.object({
  email: z.email("Please enter a valid email"),
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

const recoverSchema = z.object({
  email: z.email("Please enter a valid email"),
});

const resetPasswordSchema = z.object({
  confirmPassword: z.string().min(1, "Please confirm your password"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

export { loginSchema, recoverSchema, resetPasswordSchema, signupSchema };
