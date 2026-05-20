import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Nav } from "./nav";

const { pushMock, refreshMock, signOutMock, toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  signOutMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

vi.mock("@repo/ui/components/sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

vi.mock("@/lib/auth-client", () => ({
  signOut: signOutMock,
}));

const renderTeamNav = () =>
  render(
    <Nav
      isAdmin
      isAuthenticated
      isEditingName={false}
      onCancelEdit={vi.fn()}
      onEditName={vi.fn()}
      onNameChange={vi.fn()}
      onSaveName={vi.fn()}
      teamName="Product"
      variant="team"
    />,
  );

describe("Nav", () => {
  beforeEach(() => {
    pushMock.mockClear();
    refreshMock.mockClear();
    signOutMock.mockReset();
    toastErrorMock.mockClear();
    toastSuccessMock.mockClear();

    signOutMock.mockImplementation((options?: { fetchOptions?: { onSuccess?: () => void } }) => {
      options?.fetchOptions?.onSuccess?.();
      return Promise.resolve({});
    });
  });

  it("renders an account menu with settings and sign out in the authenticated default nav", async () => {
    render(<Nav isAuthenticated />);

    fireEvent.click(screen.getByLabelText("Account menu"));

    expect(await screen.findByText("Account")).toBeTruthy();
    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.getByText("Sign out")).toBeTruthy();
  });

  it("renders the sign-in action in the unauthenticated default nav", () => {
    const { container } = render(<Nav isAuthenticated={false} />);

    expect(container.querySelector('a[href="/login"]')).toBeTruthy();
    expect(screen.queryByLabelText("Account menu")).toBeNull();
  });

  it("renders sign out in the authenticated mobile team menu", async () => {
    renderTeamNav();

    fireEvent.click(screen.getByLabelText("Open menu"));

    expect(await screen.findByText("Sign out")).toBeTruthy();
  });

  it("signs out from the account menu", async () => {
    render(<Nav isAuthenticated />);

    fireEvent.click(screen.getByLabelText("Account menu"));
    fireEvent.click(await screen.findByText("Sign out"));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Signed out successfully");
    expect(pushMock).toHaveBeenCalledWith("/");
    expect(refreshMock).toHaveBeenCalled();
  });
});
