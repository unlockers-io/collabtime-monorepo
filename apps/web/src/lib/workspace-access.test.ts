import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSession, VALID_UUID } from "./actions/test-helpers";
import {
  captureAccessCheck,
  issueAccessCookie,
  parseAccessCookies,
  resolveViewer,
} from "./workspace-access";
import { createTestAccessStore } from "./workspace-access-test-store";

const HASH = "$2b$10$abcdefghijklmnopqrstuv";
const HINT = "cmf99999999999999999999999";

type ViewedSpace = Parameters<typeof resolveViewer>[0]["space"];

const privateSpace: ViewedSpace = {
  accessPassword: HASH,
  id: "space-1",
  isPrivate: true,
  ownerId: "owner-1",
  teamId: VALID_UUID,
};

const publicSpace = { ...privateSpace, isPrivate: false };
const member = createMockSession({ email: "member@example.com", userId: "user-1" });

const setup = () => {
  const access = createTestAccessStore();

  const viewerOf = (
    session: ReturnType<typeof createMockSession> | null,
    space: ViewedSpace = privateSpace,
    inviteHint?: string,
  ) => resolveViewer({ inviteHint, session, space }, access.store);

  const guestWithCookie = (token: string, space: ViewedSpace = privateSpace) => {
    access.setToken(space.id, token);

    return viewerOf(null, space);
  };

  return { access, guestWithCookie, viewerOf };
};

beforeEach(() => {
  vi.stubEnv("SPACE_ACCESS_SECRET", "test-space-secret-at-least-32-characters");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("resolveViewer access", () => {
  it("lets guests view a public space without reading cookies or membership", async () => {
    const { access, viewerOf } = setup();

    expect(await viewerOf(null, publicSpace)).toEqual({
      canView: true,
      guestGrant: false,
      inviteMismatch: undefined,
      isArchived: false,
      isOwner: false,
      status: "none",
    });
    expect(access.store.getToken).not.toHaveBeenCalled();
    expect(access.store.findMembership).not.toHaveBeenCalled();
  });

  it("denies a private space to guests without an access cookie", async () => {
    const { viewerOf } = setup();

    expect(await viewerOf(null)).toMatchObject({ canView: false, guestGrant: false });
  });

  it("grants a guest holding a cookie issued for the space's current password", async () => {
    const { access, guestWithCookie } = setup();

    const viewer = await guestWithCookie(issueAccessCookie(privateSpace.id, HASH).value);

    expect(viewer).toMatchObject({ canView: true, guestGrant: true, status: "none" });
    expect(access.store.findMembership).not.toHaveBeenCalled();
  });

  it.each([
    ["another space", () => issueAccessCookie("other-space", HASH).value],
    ["a rotated password", () => issueAccessCookie(privateSpace.id, "old-password-hash").value],
    [
      "a tampered signature",
      () => `${issueAccessCookie(privateSpace.id, HASH).value.slice(0, -5)}XXXXX`,
    ],
    ["a malformed token", () => "not.a.valid.token"],
  ])("denies a cookie issued for %s", async (_name, token) => {
    const { guestWithCookie } = setup();

    expect(await guestWithCookie(token())).toMatchObject({ canView: false, guestGrant: false });
  });

  it("denies an expired cookie", async () => {
    const { guestWithCookie } = setup();
    const { value } = issueAccessCookie(privateSpace.id, HASH);
    vi.useFakeTimers();
    vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);

    expect(await guestWithCookie(value)).toMatchObject({ canView: false, guestGrant: false });
  });

  it("denies every cookie once the space has no password", async () => {
    const { guestWithCookie } = setup();
    const { value } = issueAccessCookie(privateSpace.id, HASH);

    const viewer = await guestWithCookie(value, { ...privateSpace, accessPassword: null });

    expect(viewer).toMatchObject({ canView: false, guestGrant: false });
  });

  it("admits a member to a private space with one membership read", async () => {
    const { access, viewerOf } = setup();
    access.addMembership(VALID_UUID, "user-1", { role: "ADMIN" });

    expect(await viewerOf(member)).toMatchObject({
      canView: true,
      isArchived: false,
      status: "ADMIN",
    });
    expect(access.store.findMembership).toHaveBeenCalledOnce();
    expect(access.store.findMembership).toHaveBeenCalledWith(VALID_UUID, "user-1");
  });

  it("denies a signed-in non-member of a private space", async () => {
    const { viewerOf } = setup();

    expect(await viewerOf(member)).toMatchObject({ canView: false, status: "none" });
  });

  it("reports archived memberships", async () => {
    const { access, viewerOf } = setup();
    access.addMembership(VALID_UUID, "user-1", { archivedAt: new Date() });

    expect(await viewerOf(member)).toMatchObject({ isArchived: true, status: "MEMBER" });
  });

  it("propagates membership failures instead of granting access", async () => {
    const { access, viewerOf } = setup();
    const failure = new Error("database unavailable");
    access.store.findMembership.mockRejectedValue(failure);

    await expect(viewerOf(member)).rejects.toBe(failure);
  });

  it("flags the space owner only", async () => {
    const { viewerOf } = setup();
    const owner = createMockSession({ userId: "owner-1" });

    expect(await viewerOf(owner, publicSpace)).toMatchObject({ isOwner: true });
    expect(await viewerOf(member, publicSpace)).toMatchObject({ isOwner: false });
    expect(await viewerOf(null, publicSpace)).toMatchObject({ isOwner: false });
  });
});

describe("resolveViewer relation", () => {
  it("surfaces an open invitation addressed to the viewer's normalized email", async () => {
    const { access, viewerOf } = setup();
    access.addInvitation({ email: "member@example.com", id: "invite-1", teamId: VALID_UUID });
    const session = createMockSession({ email: " MEMBER@Example.com ", userId: "user-1" });

    expect(await viewerOf(session)).toMatchObject({
      canView: false,
      invitation: { id: "invite-1", inviterName: "Owner" },
      status: "INVITED",
    });
  });

  it.each([{ status: "DECLINED" }, { status: "ACCEPTED" }, { expiresAt: new Date(0) }])(
    "ignores a closed invitation: %j",
    async (override) => {
      const { access, viewerOf } = setup();
      access.addInvitation({ email: "member@example.com", teamId: VALID_UUID, ...override });

      const viewer = await viewerOf(member);

      expect(viewer.status).toBe("none");
      expect(viewer.invitation).toBeUndefined();
    },
  );

  it("prioritizes membership over an invitation, and an invitation over a join request", async () => {
    const { access, viewerOf } = setup();
    access.addInvitation({ email: "member@example.com", teamId: VALID_UUID });
    access.addJoinRequest(VALID_UUID, "user-1");

    expect(await viewerOf(member, publicSpace)).toMatchObject({ status: "INVITED" });
    access.addMembership(VALID_UUID, "user-1");
    const viewer = await viewerOf(member, publicSpace);
    expect(viewer.status).toBe("MEMBER");
    expect(viewer.invitation).toBeUndefined();
  });

  it("reports a pending join request", async () => {
    const { access, viewerOf } = setup();
    access.addJoinRequest(VALID_UUID, "user-1");

    expect(await viewerOf(member, publicSpace)).toMatchObject({ status: "PENDING" });
    access.addJoinRequest(VALID_UUID, "user-1", "REJECTED");
    expect(await viewerOf(member, publicSpace)).toMatchObject({ status: "none" });
  });

  it("masks a hinted invitation addressed to another email", async () => {
    const { access, viewerOf } = setup();
    access.addInvitation({ email: "friend@example.com", id: HINT, teamId: VALID_UUID });

    expect(await viewerOf(member, publicSpace, HINT)).toMatchObject({
      inviteMismatch: { invitedEmailMasked: "f***@example.com" },
      status: "none",
    });
  });

  it.each([
    { email: "MEMBER@example.com" },
    { teamId: "another-team" },
    { status: "REVOKED" },
    { expiresAt: new Date(0) },
  ])(
    "hides the hint for the viewer's own, unrelated or closed invitation: %j",
    async (override) => {
      const { access, viewerOf } = setup();
      access.addInvitation({
        email: "friend@example.com",
        id: HINT,
        teamId: VALID_UUID,
        ...override,
      });

      expect(await viewerOf(member, publicSpace, HINT)).toMatchObject({
        inviteMismatch: undefined,
      });
    },
  );

  it("does not look the hint up for guests or members", async () => {
    const { access, viewerOf } = setup();

    await viewerOf(null, privateSpace, HINT);
    access.addMembership(VALID_UUID, "user-1");
    await viewerOf(member, publicSpace, HINT);

    expect(access.store.findInvitationById).not.toHaveBeenCalled();
  });
});

describe("captureAccessCheck", () => {
  it("reads the cookie once and rechecks the current password and membership", async () => {
    const { access } = setup();
    access.setToken(privateSpace.id, issueAccessCookie(privateSpace.id, HASH).value);
    const canView = await captureAccessCheck(privateSpace.id, "user-1", access.store);

    expect(await canView(privateSpace)).toBe(true);
    expect(await canView({ ...privateSpace, accessPassword: "rotated-hash" })).toBe(false);
    access.addMembership(VALID_UUID, "user-1");
    expect(await canView({ ...privateSpace, accessPassword: "rotated-hash" })).toBe(true);
    access.removeMembership(VALID_UUID, "user-1");
    expect(await canView({ ...privateSpace, accessPassword: "rotated-hash" })).toBe(false);
    expect(access.store.getToken).toHaveBeenCalledOnce();
  });
});

describe("access cookie", () => {
  it("is an http-only cookie that lasts as long as its token", () => {
    expect(issueAccessCookie(privateSpace.id, HASH)).toMatchObject({
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60,
      name: `space-access-${privateSpace.id}`,
      sameSite: "lax",
    });
  });

  it("does not leak the stored hash into the readable payload", () => {
    const [payload = ""] = issueAccessCookie(privateSpace.id, HASH).value.split(".");

    expect(Buffer.from(payload, "base64url").toString("utf8")).not.toContain(HASH);
  });

  it("falls back to BETTER_AUTH_SECRET without a dedicated secret", async () => {
    vi.stubEnv("SPACE_ACCESS_SECRET", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-at-least-32-characters-long");
    const { guestWithCookie } = setup();

    const viewer = await guestWithCookie(issueAccessCookie(privateSpace.id, HASH).value);

    expect(viewer).toMatchObject({ guestGrant: true });
  });

  it("ignores BETTER_AUTH_SECRET rotation when a dedicated secret is present", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "signing-secret-at-least-32-characters-long");
    const { value } = issueAccessCookie(privateSpace.id, HASH);
    vi.stubEnv("BETTER_AUTH_SECRET", "rotated-auth-secret-at-least-32-characters-long");
    const { guestWithCookie } = setup();

    expect(await guestWithCookie(value)).toMatchObject({ guestGrant: true });
  });

  it("parses access cookies out of a cookie header", () => {
    expect(parseAccessCookies(null)).toEqual([]);
    expect(
      parseAccessCookies(
        "session=abc; space-access-a=one; theme; space-access-b=t%3Dwo; space-access-c=%E0",
      ),
    ).toEqual([
      { spaceId: "a", token: "one" },
      { spaceId: "b", token: "t=wo" },
      { spaceId: "c", token: "%E0" },
    ]);
  });
});
