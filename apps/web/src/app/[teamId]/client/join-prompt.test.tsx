import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { JoinPrompt } from "./join-prompt";

it("offers signup and login with the complete invitation destination", () => {
  const returnTo = "/team?invite=cmf12345678901234567890123";
  render(
    <JoinPrompt
      isAuthenticated={false}
      isRequestingJoin={false}
      onRequestJoin={vi.fn<() => void>()}
      returnTo={returnTo}
      teamId="team"
      teamStatus="none"
    />,
  );
  expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
    "href",
    `/register?redirect=${encodeURIComponent(returnTo)}`,
  );
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    `/login?redirect=${encodeURIComponent(returnTo)}`,
  );
});
