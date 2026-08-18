import { prisma } from "@repo/db";

import { getSession } from "@/lib/auth-server";
import { isTeamRole } from "@/types";
import type { TeamRole } from "@/types";

type TeamAuthResult = {
  role: TeamRole;
  userId: string;
};

type TeamAuthDeps = {
  findMembership: (teamId: string, userId: string) => Promise<{ role: string } | null>;
  getSession: typeof getSession;
};

const createTeamAuth = (deps: TeamAuthDeps) => {
  const getTeamRole = async (teamId: string): Promise<TeamAuthResult | null> => {
    const session = await deps.getSession();

    if (!session) {
      return null;
    }

    const membership = await deps.findMembership(teamId, session.user.id);

    if (!membership) {
      return null;
    }

    if (!isTeamRole(membership.role)) {
      return null;
    }

    return {
      role: membership.role,
      userId: session.user.id,
    };
  };

  const requireTeamAdmin = async (teamId: string): Promise<string> => {
    const result = await getTeamRole(teamId);

    if (!result) {
      throw new Error("Not a member of this team");
    }

    if (result.role !== "ADMIN") {
      throw new Error("Admin access required");
    }

    return result.userId;
  };

  const requireTeamMember = async (teamId: string): Promise<string> => {
    const result = await getTeamRole(teamId);

    if (!result) {
      throw new Error("Not a member of this team");
    }

    return result.userId;
  };

  const requireAuth = async () => {
    const session = await deps.getSession();

    if (!session) {
      throw new Error("Authentication required");
    }

    return session;
  };

  return { getTeamRole, requireAuth, requireTeamAdmin, requireTeamMember };
};

const { getTeamRole, requireAuth, requireTeamAdmin, requireTeamMember } = createTeamAuth({
  findMembership: (teamId, userId) =>
    prisma.membership.findUnique({
      select: { role: true },
      where: { userId_teamId: { teamId, userId } },
    }),
  getSession,
});

export { createTeamAuth, getTeamRole, requireAuth, requireTeamAdmin, requireTeamMember };
