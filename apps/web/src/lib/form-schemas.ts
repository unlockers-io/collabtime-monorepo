import { PASSWORD_LENGTH } from "@repo/auth/policy";
import { z } from "zod";

import { upToCharacters } from "./limits";

const ACCOUNT_NAME_MAX_LENGTH = 100;

const emailSchema = z.email("Please enter a valid email");

const newPasswordSchema = z
  .string()
  .min(PASSWORD_LENGTH.min, `Password must be at least ${PASSWORD_LENGTH.min} characters`)
  .max(PASSWORD_LENGTH.max, "Password is too long");

const accountNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(ACCOUNT_NAME_MAX_LENGTH, `Name must be ${ACCOUNT_NAME_MAX_LENGTH} characters or less`);

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z.object({
  email: emailSchema,
  name: accountNameSchema,
  password: newPasswordSchema,
});

const recoverSchema = z.object({ email: emailSchema });

const resetPasswordSchema = z
  .object({
    confirmPassword: z.string().min(1, "Please confirm your password"),
    password: newPasswordSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const ACCOUNT_NAME_HINT = upToCharacters(ACCOUNT_NAME_MAX_LENGTH);
const NEW_PASSWORD_HINT = `Must be at least ${PASSWORD_LENGTH.min} characters long.`;

export {
  ACCOUNT_NAME_HINT,
  accountNameSchema,
  loginSchema,
  NEW_PASSWORD_HINT,
  recoverSchema,
  resetPasswordSchema,
  signupSchema,
};
