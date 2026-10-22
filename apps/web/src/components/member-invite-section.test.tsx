import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { MemberInviteSection } from "./member-invite-section";

const mocks = vi.hoisted(() => ({ inviteMember: vi.fn() }));
vi.mock("@/lib/actions/invitation-actions", () => ({ inviteMember: mocks.inviteMember }));

beforeEach(() => {
  vi.resetAllMocks();
});

const renderSection = () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemberInviteSection memberId="member-1" teamId="team-1" />
    </QueryClientProvider>,
  );
  return {
    email: screen.getByLabelText("Invite by email"),
    send: screen.getByRole("button", { name: "Send invitation" }),
  };
};

const error = "Enter a valid email address";

it("checks the email when sending, then on every change", async () => {
  const { email, send } = renderSection();
  expect(send).toBeDisabled();

  fireEvent.change(email, { target: { value: "ada" } });
  fireEvent.blur(email);
  expect(screen.queryByText(error)).not.toBeInTheDocument();
  expect(send).toBeEnabled();

  fireEvent.click(send);
  expect(await screen.findByText(error)).toBeVisible();
  await waitFor(() => {
    expect(email).toHaveFocus();
  });

  fireEvent.change(email, { target: { value: "ada@example" } });
  expect(screen.getByText(error)).toBeVisible();

  fireEvent.change(email, { target: { value: "ada@example.com" } });
  expect(screen.queryByText(error)).not.toBeInTheDocument();
  expect(mocks.inviteMember).not.toHaveBeenCalled();
});

it("clears a failed invitation on the next change", async () => {
  mocks.inviteMember.mockResolvedValue({ error: "Already invited", success: false });
  const { email, send } = renderSection();
  fireEvent.change(email, { target: { value: "ada@example.com" } });

  fireEvent.click(send);

  expect(await screen.findByText("Already invited")).toBeVisible();
  fireEvent.change(email, { target: { value: "grace@example.com" } });
  await waitFor(() => {
    expect(screen.queryByText("Already invited")).not.toBeInTheDocument();
  });
});
