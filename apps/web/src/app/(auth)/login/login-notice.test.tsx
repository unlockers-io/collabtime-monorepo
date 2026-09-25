import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { LoginNotice as resolveLoginNotice } from "./login-notice";

const renderNotice = async (message?: string | Array<string>) =>
  render(await resolveLoginNotice({ searchParams: Promise.resolve({ message }) }));

it("confirms a completed password reset", async () => {
  await renderNotice("password-reset-success");

  expect(screen.getByRole("status")).toHaveTextContent(
    "Your password has been reset. Sign in with your new password.",
  );
});

it.each([undefined, "", "<b>hello</b>", ["password-reset-success"]])(
  "renders nothing for any other message: %o",
  async (message) => {
    const { container } = await renderNotice(message);

    expect(container).toBeEmptyDOMElement();
  },
);
