import { describe, expect, it } from "vitest";

import { loginSchema, NEW_PASSWORD_HINT, resetPasswordSchema, signupSchema } from "./form-schemas";

describe("password validation", () => {
  it.each([8, 11, 12, 128, 129])("validates signup and reset at length %i", (length) => {
    const password = "x".repeat(length);
    const expected = length >= 12 && length <= 128;
    expect(
      signupSchema.safeParse({ email: "test@example.com", name: "Test", password }).success,
    ).toBe(expected);
    expect(resetPasswordSchema.safeParse({ confirmPassword: password, password }).success).toBe(
      expected,
    );
  });

  it("keeps login compatible with existing passwords", () => {
    expect(loginSchema.safeParse({ email: "test@example.com", password: "existing" }).success).toBe(
      true,
    );
  });
});

const signupMessageFor = (password: string) =>
  signupSchema.safeParse({ email: "test@example.com", name: "Test", password }).error?.issues[0]
    ?.message;

describe("bounds the forms read from the auth policy", () => {
  it("words the password bounds as before", () => {
    expect(NEW_PASSWORD_HINT).toBe("Must be at least 12 characters long.");
    expect(signupMessageFor("x".repeat(11))).toBe("Password must be at least 12 characters");
    expect(signupMessageFor("x".repeat(129))).toBe("Password is too long");
  });
});
