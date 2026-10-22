import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import LoginForm from "./form";

const mocks = vi.hoisted(() => ({ signInEmail: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ signIn: { email: mocks.signInEmail } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

beforeEach(() => {
  vi.resetAllMocks();
});

// While the sign-up link suspends on a pending promise, jsdom never re-renders the fields.
const searchParams = Object.assign(Promise.resolve({}), { status: "fulfilled", value: {} });

const renderLogin = () => {
  render(<LoginForm searchParams={searchParams} />);
  return {
    email: screen.getByLabelText("Email"),
    password: screen.getByLabelText("Password"),
    submit: screen.getByRole("button", { name: "Sign in" }),
  };
};

it("shows no error before submit, then revalidates every change after a failed submit", async () => {
  const { email, password, submit } = renderLogin();
  fireEvent.change(email, { target: { value: "not-an-email" } });
  fireEvent.blur(email);
  expect(screen.queryByText("Please enter a valid email")).not.toBeInTheDocument();
  expect(email).toHaveAttribute("aria-invalid", "false");
  expect(submit).toBeEnabled();

  fireEvent.click(submit);

  expect(await screen.findByText("Please enter a valid email")).toBeVisible();
  expect(screen.getByText("Password is required")).toBeVisible();
  expect(email).toHaveAttribute("aria-invalid", "true");
  expect(submit).toBeEnabled();
  await waitFor(() => {
    expect(email).toHaveFocus();
  });

  fireEvent.change(email, { target: { value: "ada@example" } });
  expect(await screen.findByText("Please enter a valid email")).toBeVisible();

  fireEvent.change(email, { target: { value: "ada@example.com" } });
  await waitFor(() => {
    expect(screen.queryByText("Please enter a valid email")).not.toBeInTheDocument();
  });
  expect(screen.getByText("Password is required")).toBeVisible();

  fireEvent.change(password, { target: { value: "x" } });
  await waitFor(() => {
    expect(screen.queryByText("Password is required")).not.toBeInTheDocument();
  });
  expect(mocks.signInEmail).not.toHaveBeenCalled();
});

it("clears a failed sign-in on the next change", async () => {
  mocks.signInEmail.mockResolvedValue({ error: { code: "INVALID_EMAIL_OR_PASSWORD" } });
  const { email, password, submit } = renderLogin();
  fireEvent.change(email, { target: { value: "ada@example.com" } });
  fireEvent.change(password, { target: { value: "wrong-password" } });

  fireEvent.click(submit);

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveAttribute("data-slot", "form-alert");
  expect(alert).toHaveTextContent("Email or password is incorrect.");
  fireEvent.change(password, { target: { value: "right-password" } });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
