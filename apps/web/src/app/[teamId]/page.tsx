import { prisma } from "@repo/db";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ViewTransition } from "react";

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
    title: teamName ?? "Team Workspace",
    description: `Working hours and overlap view for ${teamName}.`,
  };
};

const getTeamStatus = async (userId: string, teamId: string): Promise<TeamStatus> => {
  const [membershipResult, joinRequestResult] = await Promise.allSettled([
    prisma.membership.findUnique({
      where: { userId_teamId: { userId, teamId } },
    }),
    prisma.joinRequest.findUnique({
      where: { userId_teamId: { userId, teamId } },
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
      where: { userId_teamId: { userId: session.user.id, teamId } },
    });

    if (!membership) {
      notFound();
    }
  }

  const teamStatus: TeamStatus = session ? await getTeamStatus(session.user.id, teamId) : "none";

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      <TeamPageClient
        teamId={teamId}
        isAuthenticated={Boolean(session)}
        teamStatus={teamStatus}
        userId={session?.user?.id}
      />
    </ViewTransition>
  );
};

export default TeamPage;
