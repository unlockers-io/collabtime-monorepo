import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSession } from "@/lib/actions/test-helpers";
import type * as WorkspaceAccess from "@/lib/workspace-access";
import { createTestAccessStore } from "@/lib/workspace-access-test-store";

import renderTeamPage from "./page";

const mocks = vi.hoisted(() => ({
  clientProps: vi.fn(),
  findSpace: vi.fn(),
  gateProps: vi.fn(),
  getPublicTeam: vi.fn(),
  getSession: vi.fn(),
  notFound: vi.fn(),
}));
vi.mock("@repo/db", () => ({ prisma: { space: { findUnique: mocks.findSpace } } }));
vi.mock("@/lib/auth-server", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/actions/team-read", () => ({ getPublicTeam: mocks.getPublicTeam }));
vi.mock("@/lib/team-meta", () => ({ getTeamName: vi.fn() }));
vi.mock("@/lib/workspace-access", async (importOriginal) => {
  const actual = await importOriginal<typeof WorkspaceAccess>();
  return {
    resolveViewer: (input: Parameters<typeof actual.resolveViewer>[0]) =>
      actual.resolveViewer(input, access.store),
  };
});
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/providers/query-provider", () => ({
  QueryProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./client", () => ({
  TeamPageClient: (props: { teamStatus: string }) => {
    mocks.clientProps(props);
    return <p>Workspace: {props.teamStatus}</p>;
  },
}));
vi.mock("./private-space-gate", () => ({
  PrivateSpaceGate: (props: { returnTo: string }) => {
    mocks.gateProps(props);
    return <p>Password gate</p>;
  },
}));
vi.mock("@/components/accept-workspace-invitation", () => ({
  AcceptWorkspaceInvitation: () => <button type="button">Accept invitation</button>,
}));

const TEAM_ID = "550e8400-e29b-41d4-a716-446655440000";
const HINT = "cmf12345678901234567890123";
const params = Promise.resolve({ teamId: TEAM_ID });
const privateSpace = {
  accessPassword: "hash",
  id: "space-1",
  isPrivate: true,
  ownerId: "owner",
  teamId: TEAM_ID,
};

let access = createTestAccessStore();

const renderPage = async (invite?: string | Array<string>) => {
  render(await renderTeamPage({ params, searchParams: Promise.resolve({ invite }) }));
};

beforeEach(() => {
  vi.resetAllMocks();
  access = createTestAccessStore();
  mocks.findSpace.mockResolvedValue(privateSpace);
  mocks.getSession.mockResolvedValue(createMockSession());
  mocks.getPublicTeam.mockResolvedValue({ error: "Unavailable", success: false });
  mocks.notFound.mockImplementation(() => {
    throw new Error("Not found");
  });
});

describe("workspace access", () => {
  it("shows private invitation acceptance without fetching or hydrating the roster", async () => {
    access.addInvitation({ teamId: TEAM_ID });
    await renderPage();
    expect(screen.getByRole("button", { name: "Accept invitation" })).toBeVisible();
    expect(screen.queryByText("Password gate")).toBeNull();
    expect(mocks.getPublicTeam).not.toHaveBeenCalled();
  });

  it("does not expose private content to a signed-out visitor", async () => {
    mocks.getSession.mockResolvedValue(null);
    await renderPage();
    expect(screen.getByText("Password gate")).toBeVisible();
    expect(access.store.findInvitation).not.toHaveBeenCalled();
    expect(mocks.getPublicTeam).not.toHaveBeenCalled();
  });

  it("keeps a signed-in outsider at the gate", async () => {
    access.addInvitation({ status: "DECLINED", teamId: TEAM_ID });
    await renderPage();
    expect(screen.getByText("Password gate")).toBeVisible();
    expect(mocks.getPublicTeam).not.toHaveBeenCalled();
  });

  it("opens a private workspace to members with one membership read", async () => {
    access.addMembership(TEAM_ID, "user-123");
    access.addInvitation({ teamId: TEAM_ID });
    await renderPage();
    expect(screen.getByText("Workspace: MEMBER")).toBeVisible();
    expect(mocks.getPublicTeam).toHaveBeenCalledWith(TEAM_ID);
    expect(access.store.findMembership).toHaveBeenCalledOnce();
  });

  it("passes invitation status to a public workspace", async () => {
    mocks.findSpace.mockResolvedValue({ ...privateSpace, isPrivate: false });
    access.addInvitation({ id: "invite-1", teamId: TEAM_ID });
    await renderPage();
    expect(mocks.clientProps).toHaveBeenCalledWith(
      expect.objectContaining({
        invitationId: "invite-1",
        inviterName: "Owner",
        teamStatus: "INVITED",
      }),
    );
  });

  it("hands password and deletion controls to the owner only", async () => {
    mocks.findSpace.mockResolvedValue({ ...privateSpace, isPrivate: false });
    await renderPage();
    expect(mocks.clientProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasPassword: undefined, spaceId: null }),
    );
    mocks.getSession.mockResolvedValue(createMockSession({ userId: "owner" }));
    await renderPage();
    expect(mocks.clientProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasPassword: true, spaceId: "space-1" }),
    );
  });

  it("propagates storage failures to the error boundary instead of returning 404", async () => {
    mocks.findSpace.mockRejectedValue(new Error("Database unavailable"));
    await expect(renderPage()).rejects.toThrow("Database unavailable");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing workspace", async () => {
    mocks.findSpace.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow("Not found");
  });
});

describe("invitation hints", () => {
  beforeEach(() => {
    mocks.findSpace.mockResolvedValue({ ...privateSpace, isPrivate: false });
    access.addInvitation({ email: "friend@example.com", id: HINT, teamId: TEAM_ID });
  });

  it("shows a masked notice to a signed-in user with another email", async () => {
    await renderPage(HINT);
    expect(mocks.clientProps).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteMismatch: { invitedEmailMasked: "f***@example.com" },
        returnTo: `/${TEAM_ID}?invite=${HINT}`,
      }),
    );
  });

  it("ignores malformed and repeated hint parameters", async () => {
    await renderPage([HINT, HINT]);
    expect(mocks.clientProps).toHaveBeenCalledWith(
      expect.objectContaining({ inviteMismatch: undefined, returnTo: `/${TEAM_ID}` }),
    );
  });

  it("preserves the hint for guests at the private gate without looking it up", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.findSpace.mockResolvedValue(privateSpace);
    await renderPage(HINT);
    expect(mocks.gateProps).toHaveBeenCalledWith(
      expect.objectContaining({ returnTo: `/${TEAM_ID}?invite=${HINT}` }),
    );
    expect(access.store.findInvitationById).not.toHaveBeenCalled();
  });
});
