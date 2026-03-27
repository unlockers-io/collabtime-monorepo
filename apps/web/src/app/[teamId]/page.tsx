import { prisma } from "@repo/db";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getTeamName, validateTeam } from "@/lib/actions";
import { auth } from "@/lib/auth-server";
import { isTeamRole } from "@/types";
import type { TeamStatus } from "@/types";

import { TeamPageClient } from "./client";

type TeamPageProps = {
  params: Promise<{ teamId: string }>;
};

export const generateMetadata = async ({ params }: TeamPageProps): Promise<Metadata> => {
  const { teamId } = await params;

  const exists = await validateTeam(teamId);

  if (!exists) {
    notFound();
  }

  const teamName = await getTeamName(teamId);

  return {
    title: teamName ?? "Team Workspace",
    description: `Working hours and overlap view for ${teamName}.`,
  };
};

const getTeamStatus = async (userId: string, teamId: string): Promise<TeamStatus> => {
  const membership = await prisma.membership.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });

  if (membership && isTeamRole(membership.role)) {
    return membership.role;
  }

  const joinRequest = await prisma.joinRequest.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });

  if (joinRequest?.status === "PENDING") {
    return "PENDING";
  }

  return "none";
};

const TeamPage = async ({ params }: TeamPageProps) => {
  const { teamId } = await params;
  const exists = await validateTeam(teamId);

  if (!exists) {
    notFound();
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (process.env.CI) {
    console.log(
      "[E2E DEBUG] teamId:",
      teamId,
      "session:",
      session ? `user=${session.user.id}` : "null",
    );
  }

  const space = await prisma.space.findUnique({
    where: { teamId },
  });

  if (space?.isPrivate) {
    if (!session) {
      redirect(`/login?redirect=/${teamId}`);
    }

    // Authenticated but not a member — block access to private teams
    const membership = await prisma.membership.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId } },
    });

    if (!membership) {
      notFound();
    }
  }

  const teamStatus: TeamStatus = session ? await getTeamStatus(session.user.id, teamId) : "none";

  return (
    <TeamPageClient teamId={teamId} isAuthenticated={Boolean(session)} teamStatus={teamStatus} />
  );
};

export default TeamPage;
