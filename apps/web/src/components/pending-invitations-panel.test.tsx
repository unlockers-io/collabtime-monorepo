import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { InvitationControlsView } from "./invitation-controls";
import { PendingInvitationsPanelView } from "./pending-invitations-panel";

it("keeps expired invitations visible and exposes resend and revoke after expansion", async () => {
  const invitation = {
    createdAt: "2020-01-01T00:00:00Z",
    email: "friend@example.com",
    expiresAt: "2020-01-02T00:00:00Z",
    id: "invite",
    memberId: "slot",
  };

  const resend = vi.fn().mockResolvedValue({ data: { emailSent: true }, success: true });
  const revoke = vi.fn().mockResolvedValue({ data: undefined, success: true });
  render(
    <PendingInvitationsPanelView
      invitations={[invitation]}
      members={[]}
      renderControls={(item) => (
        <InvitationControlsView invitation={item} resend={resend} revoke={revoke} />
      )}
    />,
  );
  expect(screen.queryByText(invitation.email)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Pending invitations/ }));
  expect(screen.getByText(/Removed member · Expired/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /Resend invitation/ }));
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /Revoke invitation/ })).toBeEnabled();
  });
  expect(resend).toHaveBeenCalledWith("invite");
  fireEvent.click(screen.getByRole("button", { name: /Revoke invitation/ }));
  await waitFor(() => {
    expect(revoke).toHaveBeenCalledWith("invite");
  });
});

it("disables both row actions during delivery and restores them on failure", async () => {
  const deferred = Promise.withResolvers<{ error: string; success: false }>();
  const resend = vi.fn(() => deferred.promise);
  render(
    <InvitationControlsView
      invitation={{ email: "friend@example.com", id: "invite" }}
      resend={resend}
      revoke={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Resend invitation/ }));
  expect(screen.getByRole("button", { name: /Revoke invitation/ })).toBeDisabled();
  deferred.resolve({ error: "Rate limited", success: false });
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /Resend invitation/ })).toBeEnabled();
  });
});
