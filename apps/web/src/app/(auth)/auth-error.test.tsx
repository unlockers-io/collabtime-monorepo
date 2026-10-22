import "@testing-library/jest-dom/vitest";

import { FormAlert } from "@repo/ui/compositions/form-alert";
import { render, screen } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it } from "vitest";

import { authErrorMessage } from "./auth-error";

describe("authErrorMessage", () => {
  it("explains a wrong password in the form alert and links to recovery", () => {
    render(<FormAlert message={authErrorMessage("invalid-credentials")} />);

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
      <FormAlert
        message={authErrorMessage("account-exists", {
          signInLink: <Link href="/login">Sign in</Link>,
        })}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "An account with this email already exists. Sign in or reset your password.",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("renders no alert without an error", () => {
    render(<FormAlert message={authErrorMessage(null)} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
