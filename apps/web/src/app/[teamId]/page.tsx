import { prisma } from "@repo/db";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getTeamName, validateTeam } from "@/lib/actions/team-read";
import { getSession } from "@/lib/auth-server";
import { isTeamRole } from "@/types";
import type { TeamStatus } from "@/types";

import { TeamPageClient } from "./client";

type TeamPageProps = {
  params: Promise<{ teamId: string }>;
};

export const generateMetadata = async ({ params }: TeamPageProps): Promise<Metadata> => {
  const { teamId } = await params;

  const [existsResult, teamNameResult] = await Promise.allSettled([
    validateTeam(teamId),
    getTeamName(teamId),
  ]);

  const exists = existsResult.status === "fulfilled" ? existsResult.value : false;

  if (!exists) {
    notFound();
  }

  const teamName = teamNameResult.status === "fulfilled" ? teamNameResult.value : null;

  return {
    description: `Working hours and overlap view for ${teamName}.`,
    title: teamName ?? "Team Workspace",
  };
};

const getTeamStatus = async (userId: string, teamId: string): Promise<TeamStatus> => {
  const [membershipResult, joinRequestResult] = await Promise.allSettled([
    prisma.membership.findUnique({
      where: { userId_teamId: { teamId, userId } },
    }),
    prisma.joinRequest.findUnique({
      where: { userId_teamId: { teamId, userId } },
    }),
  ]);

  const membership = membershipResult.status === "fulfilled" ? membershipResult.value : null;

  if (membership && isTeamRole(membership.role)) {
    return membership.role;
  }

  const joinRequest = joinRequestResult.status === "fulfilled" ? joinRequestResult.value : null;

  if (joinRequest?.status === "PENDING") {
    return "PENDING";
  }

  return "none";
};

const TeamPage = async ({ params }: TeamPageProps) => {
  const { teamId } = await params;

  const [existsResult, sessionResult, spaceResult] = await Promise.allSettled([
    validateTeam(teamId),
    getSession(),
    prisma.space.findUnique({ where: { teamId } }),
  ]);

  const exists = existsResult.status === "fulfilled" ? existsResult.value : false;

  if (!exists) {
    notFound();
  }

  const session = sessionResult.status === "fulfilled" ? sessionResult.value : null;
  const space = spaceResult.status === "fulfilled" ? spaceResult.value : null;

  if (space?.isPrivate) {
    if (!session) {
      redirect(`/login?redirect=/${teamId}`);
    }

    // Authenticated but not a member — block access to private teams
    const membership = await prisma.membership.findUnique({
      where: { userId_teamId: { teamId, userId: session.user.id } },
    });

    if (!membership) {
      notFound();
    }
  }

  const teamStatus: TeamStatus = session ? await getTeamStatus(session.user.id, teamId) : "none";

  const isSpaceOwner = Boolean(session && space && space.ownerId === session.user.id);

  return (
    <TeamPageClient
      isAuthenticated={Boolean(session)}
      spaceId={isSpaceOwner ? (space?.id ?? null) : null}
      teamId={teamId}
      teamStatus={teamStatus}
      userId={session?.user?.id}
    />
  );
};

export default TeamPage;
