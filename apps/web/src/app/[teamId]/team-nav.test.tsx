import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { TeamNavView } from "./team-nav";

it("renders sign out in the authenticated mobile team menu", async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TeamNavView
        isArchived={false}
        isPrivate={false}
        navRole="admin"
        owner={null}
        signOut={{ handleSignOut: vi.fn<() => Promise<void>>(), isSigningOut: false }}
        teamId="team-1"
        teamName="Product"
      />
    </QueryClientProvider>,
  );

  fireEvent.click(screen.getByLabelText("Open menu"));

  expect(await screen.findByText("Sign out")).toBeTruthy();
});
