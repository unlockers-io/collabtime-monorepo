import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it } from "vitest";

import { AuthErrorNotice, authErrorKind } from "./auth-error";

describe("authErrorKind", () => {
  it.each([
    [{ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }, "invalid-credentials"],
    [{ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", status: 422 }, "account-exists"],
    [{ code: "INVALID_TOKEN", status: 400 }, "invalid-reset-link"],
    [{ code: "INVALID_EMAIL_OR_PASSWORD", status: 429 }, "rate-limited"],
    [{ code: "toString", status: 400 }, "unknown"],
    [{ status: 500 }, "unknown"],
  ] as const)("maps %o to %s", (error, kind) => {
    expect(authErrorKind(error)).toBe(kind);
  });
});

describe("AuthErrorNotice", () => {
  it("explains a wrong password inline and links to recovery", () => {
    render(<AuthErrorNotice kind="invalid-credentials" />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Email or password is incorrect. Try again or reset your password.",
    );
    expect(screen.getByRole("link", { name: "reset your password" })).toHaveAttribute(
      "href",
      "/recover",
    );
  });

  it("uses the provided sign-in link for an existing account", () => {
    render(
      <AuthErrorNotice kind="account-exists" signInLink={<Link href="/login">Sign in</Link>} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "An account with this email already exists. Sign in or reset your password.",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });
});
