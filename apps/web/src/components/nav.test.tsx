import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NavView } from "./nav";

const handleSignOut = vi.fn<() => Promise<void>>();
const signOut = { handleSignOut, isSigningOut: false };

const renderTeamNav = () =>
  render(
    <NavView
      isAdmin
      isAuthenticated
      isEditingName={false}
      onCancelEdit={vi.fn<() => void>()}
      onEditName={vi.fn<() => void>()}
      onNameChange={vi.fn<(name: string) => void>()}
      onSaveName={vi.fn<() => void>()}
      signOut={signOut}
      teamName="Product"
      variant="team"
    />,
  );

describe("Nav", () => {
  beforeEach(() => {
    handleSignOut.mockReset();
    handleSignOut.mockResolvedValue();
  });

  it("renders an account menu with settings and sign out in the authenticated default nav", async () => {
    render(<NavView isAuthenticated signOut={signOut} />);

    fireEvent.click(screen.getByLabelText("Account menu"));

    expect(await screen.findByText("Account")).toBeTruthy();
    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.getByText("Sign out")).toBeTruthy();
  });

  it("renders the sign-in action in the unauthenticated default nav", () => {
    const { container } = render(<NavView isAuthenticated={false} signOut={signOut} />);

    expect(container.querySelector('a[href="/login"]')).toBeTruthy();
    expect(screen.queryByLabelText("Account menu")).toBeNull();
  });

  it("renders sign out in the authenticated mobile team menu", async () => {
    renderTeamNav();

    fireEvent.click(screen.getByLabelText("Open menu"));

    expect(await screen.findByText("Sign out")).toBeTruthy();
  });

  it("signs out from the account menu", async () => {
    render(<NavView isAuthenticated signOut={signOut} />);

    fireEvent.click(screen.getByLabelText("Account menu"));
    fireEvent.click(await screen.findByText("Sign out"));

    await waitFor(() => {
      expect(handleSignOut).toHaveBeenCalledTimes(1);
    });
  });
});
