import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { PrivateSpaceGate } from "./private-space-gate";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => {
  vi.unstubAllGlobals();
});

const submitPassword = (status: number) => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status })));
  render(<PrivateSpaceGate isAuthenticated spaceId="space-1" teamId="team-1" />);
  const password = screen.getByLabelText("Password");
  fireEvent.change(password, { target: { value: "guess" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  return password;
};

it("reports a rate limit in the form alert and clears it on the next change", async () => {
  const password = submitPassword(429);

  expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts. Try again later.");
  expect(password).toHaveAttribute("aria-invalid", "false");
  fireEvent.change(password, { target: { value: "another guess" } });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("keeps a wrong password on the field until the next change", async () => {
  const password = submitPassword(401);

  expect(await screen.findByText("Incorrect password")).toBeVisible();
  expect(password).toHaveAttribute("aria-invalid", "true");
  expect(document.querySelector('[data-slot="form-alert"]')).toBeNull();
  fireEvent.change(password, { target: { value: "another guess" } });
  expect(screen.queryByText("Incorrect password")).not.toBeInTheDocument();
});
