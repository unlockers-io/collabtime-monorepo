import { prisma } from "@repo/db";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { getTeamName, validateTeam } from "@/lib/actions";
import { auth } from "@/lib/auth-server";

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

type TeamStatus = "admin" | "member" | "pending" | "none";

const getTeamStatus = async (userId: string, teamId: string): Promise<TeamStatus> => {
  const membership = await prisma.membership.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });

  if (membership) {
    return membership.role as TeamStatus;
  }

  const joinRequest = await prisma.joinRequest.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });

  if (joinRequest?.status === "pending") {
    return "pending";
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

  // Check if team is private and user is not authenticated
  const space = await prisma.space.findUnique({
    where: { teamId },
  });

  if (space?.isPrivate && !session) {
    // Redirect to login for private teams
    const { redirect } = await import("next/navigation");
    redirect(`/login?redirect=/${teamId}`);
  }

  const teamStatus: TeamStatus = session ? await getTeamStatus(session.user.id, teamId) : "none";

  return (
    <TeamPageClient teamId={teamId} isAuthenticated={Boolean(session)} teamStatus={teamStatus} />
  );
};

export default TeamPage;
