"use server";

import { prisma } from "@repo/db";
import { headers } from "next/headers";

import { auth } from "@/lib/auth-server";
import type { TeamRole } from "@/types";

type TeamAuthResult = {
  role: TeamRole;
  userId: string;
};

/**
 * Get the current user's role for a team via Membership lookup.
 * Returns null if not authenticated or not a member.
 */
const getTeamRole = async (teamId: string): Promise<TeamAuthResult | null> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return null;
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId: session.user.id,
        teamId,
      },
    },
  });

  if (!membership) {
    return null;
  }

  return {
    userId: session.user.id,
    role: membership.role as TeamRole,
  };
};

/**
 * Require admin access to a team. Returns the userId.
 * Throws if not authenticated or not an admin member.
 */
const requireTeamAdmin = async (teamId: string): Promise<string> => {
  const result = await getTeamRole(teamId);

  if (!result) {
    throw new Error("Not a member of this team");
  }

  if (result.role !== "admin") {
    throw new Error("Admin access required");
  }

  return result.userId;
};

/**
 * Require authentication. Returns the user session.
 * Throws if not authenticated.
 */
const requireAuth = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Authentication required");
  }

  return session;
};

export { getTeamRole, requireTeamAdmin, requireAuth };
