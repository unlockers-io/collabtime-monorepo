import { prisma } from "@repo/db";

import type { ActionErrorEvent, ActionResult } from "@/lib/actions/types";
import { getSession } from "@/lib/auth-server";
import { log } from "@/lib/observability";
import { isTeamRole } from "@/types";
import type { TeamRole } from "@/types";

import { UUIDSchema } from "./validation";

type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>>["user"];

type TeamAuthResult = {
  role: TeamRole;
  userId: string;
};

type TeamAccess = {
  teamId: string;
  user: SessionUser;
};

type TeamAuthDeps = {
  findMembership: (teamId: string, userId: string) => Promise<{ role: string } | null>;
  getSession: typeof getSession;
  reportError: (event: ActionErrorEvent) => void;
};

const createTeamAuth = (deps: TeamAuthDeps) => {
  const findRole = async (teamId: string, userId: string): Promise<TeamRole | null> => {
    const membership = await deps.findMembership(teamId, userId);
    return membership !== null && isTeamRole(membership.role) ? membership.role : null;
  };

  const getTeamRole = async (teamId: string): Promise<TeamAuthResult | null> => {
    const session = await deps.getSession();
    if (!session) {
      return null;
    }
    const role = await findRole(teamId, session.user.id);
    return role === null ? null : { role, userId: session.user.id };
  };

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
      const role = await findRole(teamId, auth.data.id);
      if (role === null) {
        return { error: "You are not a member of this team", success: false };
      }
      if (!allows(role)) {
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

  return { authenticate, authorizeTeamAdmin, authorizeTeamMember, getTeamRole };
};

const { authenticate, authorizeTeamAdmin, authorizeTeamMember, getTeamRole } = createTeamAuth({
  findMembership: (teamId, userId) =>
    prisma.membership.findUnique({
      select: { role: true },
      where: { userId_teamId: { teamId, userId } },
    }),
  getSession,
  reportError: log.error,
});

export { authenticate, authorizeTeamAdmin, authorizeTeamMember, createTeamAuth, getTeamRole };
export type { SessionUser, TeamAccess };
