import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import type { PendingInvitation } from "@/types";

import { HomeLists } from "./lists";
import type { MyTeam } from "./types";

vi.mock("@/lib/actions/invitation-actions", () => ({
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
}));

type HomeApiBody =
  | { error: string }
  | { invitations: Array<PendingInvitation> }
  | { teams: Array<MyTeam> };

const fetchMock = vi.fn<typeof fetch>();

const requestUrl = (input: Parameters<typeof fetch>[0]): string => {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
};

const respondWith = (resolve: (url: string) => HomeApiBody | Response) => {
  fetchMock.mockImplementation((input) => {
    const result = resolve(requestUrl(input));
    return Promise.resolve(result instanceof Response ? result : Response.json(result));
  });
};

const team: MyTeam = {
  archivedAt: null,
  memberCount: 3,
  role: "ADMIN",
  spaceId: "space-1",
  teamId: "team-1",
  teamName: "Design",
};

const renderLists = (seed?: (client: QueryClient) => void) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seed?.(client);
  return render(
    <QueryClientProvider client={client}>
      <HomeLists />
    </QueryClientProvider>,
  );
};

const teamsRequestCount = () =>
  fetchMock.mock.calls.filter(([input]) => requestUrl(input).endsWith("/api/teams")).length;

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  respondWith((url) => (url.endsWith("/api/invitations") ? { invitations: [] } : { teams: [] }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("HomeLists", () => {
  it("shows the empty state with the three steps when there is nothing to list", () => {
    renderLists((client) => {
      client.setQueryData(queryKeys.myTeams, []);
      client.setQueryData(queryKeys.invitations, []);
    });

    expect(screen.getByText("No workspaces yet")).toBeInTheDocument();
    expect(screen.getByText("Create a workspace")).toBeInTheDocument();
    expect(screen.getByText("Add your team")).toBeInTheDocument();
    expect(screen.getByText("Find the hour")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lists active workspaces instead of the empty state", () => {
    renderLists((client) => {
      client.setQueryData(queryKeys.myTeams, [team]);
      client.setQueryData(queryKeys.invitations, []);
    });

    expect(screen.getByRole("heading", { name: "Active workspaces" })).toBeInTheDocument();
    expect(screen.getByText("Design")).toBeInTheDocument();
    expect(screen.queryByText("No workspaces yet")).not.toBeInTheDocument();
  });

  it("links each row to its workspace and labels the admin role in text", () => {
    renderLists((client) => {
      client.setQueryData(queryKeys.myTeams, [
        team,
        { ...team, role: "MEMBER", spaceId: "space-2", teamId: "team-2", teamName: "Ops" },
      ]);
      client.setQueryData(queryKeys.invitations, []);
    });

    const admin = screen.getByRole("link", { name: "Design" });
    expect(admin).toHaveAttribute("href", "/team-1");
    expect(admin).toHaveAccessibleDescription("3 members · Admin");

    const member = screen.getByRole("link", { name: "Ops" });
    expect(member).toHaveAttribute("href", "/team-2");
    expect(member).toHaveAccessibleDescription("3 members");

    expect(screen.getByRole("button", { name: "More actions for Design" })).toBeInTheDocument();
  });

  it("shows a retryable error row when the teams request fails", async () => {
    respondWith((url) =>
      url.endsWith("/api/invitations")
        ? { invitations: [] }
        : Response.json({ error: "Failed to fetch teams" }, { status: 500 }),
    );

    renderLists();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load your workspaces");
    expect(screen.queryByText("No workspaces yet")).not.toBeInTheDocument();

    const before = teamsRequestCount();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(teamsRequestCount()).toBe(before + 1);
    });
  });
});

it("shows invitation expiry on the dashboard", async () => {
  const expiresAt = new Date(Date.now() + 14 * 86_400_000).toISOString();
  respondWith((url) =>
    url.endsWith("/api/invitations")
      ? {
          invitations: [
            {
              expiresAt,
              id: "invite",
              inviterName: "Owner",
              memberId: "slot",
              teamId: "team",
              teamName: "Platform",
            },
          ],
        }
      : { teams: [] },
  );
  renderLists();
  expect(await screen.findByText(/Invited by Owner · Expires in 14 days/)).toBeInTheDocument();
});
