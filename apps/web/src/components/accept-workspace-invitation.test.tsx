import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AcceptWorkspaceInvitation } from "./accept-workspace-invitation";

const mocks = vi.hoisted(() => ({
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/actions/invitation-actions", () => ({
  acceptInvitation: mocks.acceptInvitation,
  declineInvitation: mocks.declineInvitation,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("invitation acceptance", () => {
  it("keeps server-rendered decisions disabled until their handlers are ready", () => {
    const html = renderToString(<AcceptWorkspaceInvitation invitationId="invite-1" />);
    const container = document.createElement("div");
    container.innerHTML = html;
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
    render(<AcceptWorkspaceInvitation invitationId="invite-1" />);
    expect(screen.getByRole("button", { name: "Accept invitation" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Decline" })).toBeEnabled();
  });

  it("refreshes membership and workspace data after acceptance", async () => {
    mocks.acceptInvitation.mockResolvedValue({ data: { teamId: "team-1" }, success: true });
    render(<AcceptWorkspaceInvitation invitationId="invite-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));
    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalledOnce();
    });
    expect(mocks.acceptInvitation).toHaveBeenCalledWith("invite-1");
  });

  it.each([
    "This invitation is not for you",
    "This invitation is no longer pending",
    "This invitation has expired. Ask a workspace admin to resend it.",
  ])("shows the server rejection: %s", async (error) => {
    mocks.acceptInvitation.mockResolvedValue({ error, success: false });
    render(<AcceptWorkspaceInvitation invitationId="invite-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(error);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});

it("declines from the workspace and refreshes", async () => {
  mocks.declineInvitation.mockResolvedValue({ data: undefined, success: true });
  render(
    <AcceptWorkspaceInvitation invitationId="invite-1" inviterName="Owner" teamName="Platform" />,
  );
  expect(screen.getByText("Invited by Owner")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Decline" }));
  await waitFor(() => {
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  expect(mocks.declineInvitation).toHaveBeenCalledWith("invite-1");
});
it("disables acceptance and decline together while pending", () => {
  mocks.acceptInvitation.mockReturnValue(new Promise(() => {}));
  render(<AcceptWorkspaceInvitation invitationId="invite-1" />);
  fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));
  expect(screen.getByRole("button", { name: "Accepting…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled();
});
