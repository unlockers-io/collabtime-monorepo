import { prisma } from "@repo/db";

import { getSession } from "@/lib/auth-server";
import { isTeamRole } from "@/types";
import type { TeamRole } from "@/types";

type TeamAuthResult = {
  role: TeamRole;
  userId: string;
};

const getTeamRole = async (teamId: string): Promise<TeamAuthResult | null> => {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        teamId,
        userId: session.user.id,
      },
    },
  });

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

const requireAuth = async () => {
  const session = await getSession();

  if (!session) {
    throw new Error("Authentication required");
  }

  return session;
};

export { getTeamRole, requireTeamAdmin, requireAuth };
