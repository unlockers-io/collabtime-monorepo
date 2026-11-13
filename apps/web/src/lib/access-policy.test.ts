import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamStatus } from "@/types";

import { createMockSession, VALID_UUID } from "./actions/test-helpers";
import { isSpaceOwner } from "./team-auth";
import { resolveViewer } from "./team-viewer";
import { issueAccessCookie } from "./workspace-access";
import { createTestAccessStore } from "./workspace-access-test-store";

const HASH = "$2b$10$abcdefghijklmnopqrstuv";
const OWNER_ID = "owner-1";
const USER_ID = "user-1";
const EMAIL = "caller@example.com";

const privateSpace = {
  accessPassword: HASH,
  id: "space-1",
  isPrivate: true,
  ownerId: OWNER_ID,
  teamId: VALID_UUID,
};

const spaces = { private: privateSpace, public: { ...privateSpace, isPrivate: false } };

type Access = ReturnType<typeof createTestAccessStore>;

type Caller = { arrange?: (access: Access) => void; userId?: string };

const SIGNED_OUT = "Authentication required";
const NOT_A_MEMBER = "You are not a member of this team";
const NOT_AN_ADMIN = "Admin access required";

const withCookie = (hash: string) => (access: Access) => {
  access.setToken(privateSpace.id, issueAccessCookie(privateSpace.id, hash).value);
};

const invited = (expiresAt: Date | null) => (access: Access) => {
  access.addInvitation({ email: EMAIL, expiresAt, teamId: VALID_UUID });
};

const member =
  (role: "ADMIN" | "MEMBER", archivedAt: Date | null = null, userId = USER_ID) =>
  (access: Access) => {
    access.addMembership(VALID_UUID, userId, { archivedAt, role });
  };

/**
 * Who may do what. `view` is [public space, private space]; `changeOwn` and `administer`
 * are `true` or the refusal the caller reads.
 */
const policy: Array<
  [
    string,
    Caller,
    {
      administer: string | true;
      changeOwn: string | true;
      manageSpace: boolean;
      status: TeamStatus;
      view: [boolean, boolean];
    },
  ]
> = [
  [
    "a guest",
    {},
    {
      administer: SIGNED_OUT,
      changeOwn: SIGNED_OUT,
      manageSpace: false,
      status: "none",
      view: [true, false],
    },
  ],
  [
    "a guest holding the current password cookie",
    { arrange: withCookie(HASH) },
    {
      administer: SIGNED_OUT,
      changeOwn: SIGNED_OUT,
      manageSpace: false,
      status: "none",
      view: [true, true],
    },
  ],
  [
    "a guest holding a cookie for a rotated password",
    { arrange: withCookie("old-password-hash") },
    {
      administer: SIGNED_OUT,
      changeOwn: SIGNED_OUT,
      manageSpace: false,
      status: "none",
      view: [true, false],
    },
  ],
  [
    "a signed-in stranger",
    { userId: USER_ID },
    {
      administer: NOT_A_MEMBER,
      changeOwn: NOT_A_MEMBER,
      manageSpace: false,
      status: "none",
      view: [true, false],
    },
  ],
  [
    "a signed-in stranger holding the current password cookie",
    { arrange: withCookie(HASH), userId: USER_ID },
    {
      administer: NOT_A_MEMBER,
      changeOwn: NOT_A_MEMBER,
      manageSpace: false,
      status: "none",
      view: [true, true],
    },
  ],
  [
    "a user with a pending join request",
    {
      arrange: (access) => {
        access.addJoinRequest(VALID_UUID, USER_ID);
      },
      userId: USER_ID,
    },
    {
      administer: NOT_A_MEMBER,
      changeOwn: NOT_A_MEMBER,
      manageSpace: false,
      status: "PENDING",
      view: [true, false],
    },
  ],
  [
    "a user with an open invitation",
    { arrange: invited(null), userId: USER_ID },
    {
      administer: NOT_A_MEMBER,
      changeOwn: NOT_A_MEMBER,
      manageSpace: false,
      status: "INVITED",
      view: [true, false],
    },
  ],
  [
    "a user with an expired invitation",
    { arrange: invited(new Date(0)), userId: USER_ID },
    {
      administer: NOT_A_MEMBER,
      changeOwn: NOT_A_MEMBER,
      manageSpace: false,
      status: "none",
      view: [true, false],
    },
  ],
  [
    "a member",
    { arrange: member("MEMBER"), userId: USER_ID },
    {
      administer: NOT_AN_ADMIN,
      changeOwn: true,
      manageSpace: false,
      status: "MEMBER",
      view: [true, true],
    },
  ],
  [
    "a member who archived the workspace",
    { arrange: member("MEMBER", new Date(0)), userId: USER_ID },
    {
      administer: NOT_AN_ADMIN,
      changeOwn: true,
      manageSpace: false,
      status: "MEMBER",
      view: [true, true],
    },
  ],
  [
    "an admin who does not own the space",
    { arrange: member("ADMIN"), userId: USER_ID },
    { administer: true, changeOwn: true, manageSpace: false, status: "ADMIN", view: [true, true] },
  ],
  [
    "the owner",
    { arrange: member("ADMIN", null, OWNER_ID), userId: OWNER_ID },
    { administer: true, changeOwn: true, manageSpace: true, status: "ADMIN", view: [true, true] },
  ],
  [
    "an owner whose membership is gone",
    { userId: OWNER_ID },
    {
      administer: NOT_A_MEMBER,
      changeOwn: NOT_A_MEMBER,
      manageSpace: true,
      status: "none",
      view: [true, false],
    },
  ],
];

const answersFor = async ({ arrange, userId }: Caller) => {
  const access = createTestAccessStore();
  arrange?.(access);
  const session = userId === undefined ? null : createMockSession({ email: EMAIL, userId });
  access.signIn(session);
  const guards = access.auth;

  const guarded = async (guard: typeof guards.authorizeTeamAdmin) => {
    const result = await guard(VALID_UUID);

    return result.success || result.error;
  };

  const seen = async (space: typeof privateSpace) => {
    const viewer = await resolveViewer(
      { inviteHint: undefined, session, space },
      access.viewerDeps,
    );

    const canViewLive = await guards.captureAccessCheck(space.id, userId);

    return { ...viewer, live: await canViewLive(space) };
  };

  const [onPublic, onPrivate] = await Promise.all([seen(spaces.public), seen(spaces.private)]);
  expect(isSpaceOwner(spaces.private, userId)).toBe(onPrivate.isOwner);

  return {
    administer: await guarded(guards.authorizeTeamAdmin),
    changeOwn: await guarded(guards.authorizeTeamMember),
    liveView: [onPublic.live, onPrivate.live],
    manageSpace: onPrivate.isOwner,
    pageView: [onPublic.canView, onPrivate.canView],
    status: onPrivate.status,
  };
};

beforeEach(() => {
  vi.stubEnv("SPACE_ACCESS_SECRET", "test-space-secret-at-least-32-characters");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("who may do what to a team", () => {
  it.each(policy)("%s", async (_name, caller, { view, ...allowed }) => {
    expect(await answersFor(caller)).toEqual({ ...allowed, liveView: view, pageView: view });
  });
});
