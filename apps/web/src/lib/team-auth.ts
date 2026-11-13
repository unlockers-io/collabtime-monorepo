import { prisma } from "@repo/db";

import type { ActionErrorEvent, ActionResult } from "@/lib/actions/types";
import { getSession } from "@/lib/auth-server";
import { log } from "@/lib/observability";
import type { TeamRole } from "@/types";

import { UUIDSchema } from "./validation";
import { readAccessToken, verifyAccessToken } from "./workspace-access";

type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>>["user"];

type TeamAccess = {
  teamId: string;
  user: SessionUser;
};

type TeamSpace = {
  accessPassword: string | null;
  id: string;
  isPrivate: boolean;
  ownerId: string;
  teamId: string;
};

type Membership = { archivedAt: Date | null; role: TeamRole };

type AccessCheck = (space: TeamSpace) => Promise<boolean>;

type TeamAuthDeps = {
  findMembership: (teamId: string, userId: string) => Promise<Membership | null>;
  getSession: typeof getSession;
  readAccessToken: (spaceId: string) => Promise<string | undefined>;
  reportError: (event: ActionErrorEvent) => void;
};

/** Visibility and deletion belong to the owner, whatever their role. */
const isSpaceOwner = (space: Pick<TeamSpace, "ownerId">, userId: string | undefined): boolean =>
  space.ownerId === userId;

const createTeamAuth = (deps: TeamAuthDeps) => {
  const authenticate = async (): Promise<ActionResult<SessionUser>> => {
    const session = await deps.getSession();

    return session
      ? { data: session.user, success: true }
      : { error: "Authentication required", success: false };
  };

  const authorizeTeam = async (
    teamId: string,
    allows: (role: TeamRole) => boolean,
  ): Promise<ActionResult<TeamAccess>> => {
    if (!UUIDSchema.safeParse(teamId).success) {
      return { error: "Invalid team ID", success: false };
    }

    const auth = await authenticate();

    if (!auth.success) {
      return auth;
    }

    try {
      const membership = await deps.findMembership(teamId, auth.data.id);

      if (membership === null) {
        return { error: "You are not a member of this team", success: false };
      }

      if (!allows(membership.role)) {
        return { error: "Admin access required", success: false };
      }

      return { data: { teamId, user: auth.data }, success: true };
    } catch (error) {
      deps.reportError({ error, message: "Failed to authorize", route: "lib/team-auth", teamId });

      return { error: "Could not verify your access. Try again.", success: false };
    }
  };

  const authorizeTeamAdmin = (teamId: string) => authorizeTeam(teamId, (role) => role === "ADMIN");

  const authorizeTeamMember = (teamId: string) => authorizeTeam(teamId, () => true);

  const hasGuestGrant = async (
    space: TeamSpace,
    readToken: TeamAuthDeps["readAccessToken"],
  ): Promise<boolean> => {
    if (!space.isPrivate) {
      return false;
    }

    const token = await readToken(space.id);

    return token !== undefined && verifyAccessToken(token, space.id, space.accessPassword);
  };

  const canView = async (
    space: TeamSpace,
    userId: string | undefined,
    readToken: TeamAuthDeps["readAccessToken"],
  ): Promise<boolean> =>
    !space.isPrivate ||
    (await hasGuestGrant(space, readToken)) ||
    (userId !== undefined && (await deps.findMembership(space.teamId, userId)) !== null);

  /** A public space is open to anyone; a private one to its members and password holders. */
  const canViewTeam = (space: TeamSpace, userId: string | undefined): Promise<boolean> =>
    canView(space, userId, deps.readAccessToken);

  /** Reads the cookie once up front: live-stream rechecks run after the request has ended. */
  const captureAccessCheck = async (
    spaceId: string,
    userId: string | undefined,
  ): Promise<AccessCheck> => {
    const token = await deps.readAccessToken(spaceId);

    return (space) => canView(space, userId, () => Promise.resolve(token));
  };

  /** `canViewTeam` with what granted it, for the page that has to show both. */
  const readTeamAccess = async (space: TeamSpace, userId: string | undefined) => {
    const [guestGrant, membership] = await Promise.all([
      hasGuestGrant(space, deps.readAccessToken),
      userId === undefined ? null : deps.findMembership(space.teamId, userId),
    ]);

    return {
      canView: !space.isPrivate || guestGrant || membership !== null,
      guestGrant,
      isOwner: isSpaceOwner(space, userId),
      membership,
    };
  };

  return {
    authenticate,
    authorizeTeamAdmin,
    authorizeTeamMember,
    canViewTeam,
    captureAccessCheck,
    readTeamAccess,
  };
};

const findTeamSpace = (teamId: string): Promise<TeamSpace | null> =>
  prisma.space.findUnique({
    select: { accessPassword: true, id: true, isPrivate: true, ownerId: true, teamId: true },
    where: { teamId },
  });

const {
  authenticate,
  authorizeTeamAdmin,
  authorizeTeamMember,
  canViewTeam,
  captureAccessCheck,
  readTeamAccess,
} = createTeamAuth({
  findMembership: (teamId, userId) =>
    prisma.membership.findUnique({
      select: { archivedAt: true, role: true },
      where: { userId_teamId: { teamId, userId } },
    }),
  getSession,
  readAccessToken,
  reportError: log.error,
});

export {
  authenticate,
  authorizeTeamAdmin,
  authorizeTeamMember,
  canViewTeam,
  captureAccessCheck,
  createTeamAuth,
  findTeamSpace,
  isSpaceOwner,
  readTeamAccess,
};

export type { AccessCheck, SessionUser, TeamAccess, TeamSpace };
