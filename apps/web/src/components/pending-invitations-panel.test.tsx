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
  const onSettled = vi.fn<() => void>();
  render(
    <PendingInvitationsPanelView
      invitations={[invitation]}
      members={[]}
      renderControls={(item) => (
        <InvitationControlsView
          invitation={item}
          onSettled={onSettled}
          resend={resend}
          revoke={revoke}
          teamId="team"
        />
      )}
    />,
  );
  expect(screen.queryByText(invitation.email)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Pending invitations/ }));
  expect(screen.getByText(/Removed member · Expired/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /Resend invitation/ }));
  await waitFor(() => {
    expect(onSettled).toHaveBeenCalledTimes(1);
  });
  expect(resend).toHaveBeenCalledWith("team", "invite");
  fireEvent.click(screen.getByRole("button", { name: /Revoke invitation/ }));
  await waitFor(() => {
    expect(onSettled).toHaveBeenCalledTimes(2);
  });
  expect(revoke).toHaveBeenCalledWith("team", "invite");
});
it("disables both row actions during delivery and restores them on failure", async () => {
  const deferred = Promise.withResolvers<{ error: string; success: false }>();
  const resend = vi.fn(() => deferred.promise);
  const onSettled = vi.fn<() => void>();
  render(
    <InvitationControlsView
      invitation={{ email: "friend@example.com", id: "invite" }}
      onSettled={onSettled}
      resend={resend}
      revoke={vi.fn()}
      teamId="team"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Resend invitation/ }));
  expect(screen.getByRole("button", { name: /Revoke invitation/ })).toBeDisabled();
  deferred.resolve({ error: "Rate limited", success: false });
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /Resend invitation/ })).toBeEnabled();
  });
  expect(onSettled).toHaveBeenCalledOnce();
});
