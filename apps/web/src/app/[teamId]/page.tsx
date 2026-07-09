import { prisma } from "@repo/db";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { getTeamName, validateTeam } from "@/lib/actions/team-read";
import { getSession } from "@/lib/auth-server";
import { SPACE_ACCESS_COOKIE_PREFIX, verifySpaceAccessToken } from "@/lib/space-access";
import { isTeamRole } from "@/types";
import type { TeamStatus } from "@/types";

import { TeamPageClient } from "./client";
import { PrivateSpaceGate } from "./private-space-gate";

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

type TeamStatusResult = {
  isArchived: boolean;
  status: TeamStatus;
};

const getTeamStatus = async (userId: string, teamId: string): Promise<TeamStatusResult> => {
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
    return { isArchived: membership.archivedAt !== null, status: membership.role };
  }

  const joinRequest = joinRequestResult.status === "fulfilled" ? joinRequestResult.value : null;

  if (joinRequest?.status === "PENDING") {
    return { isArchived: false, status: "PENDING" };
  }

  return { isArchived: false, status: "none" };
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
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(`${SPACE_ACCESS_COOKIE_PREFIX}${space.id}`)?.value;
    const hasGuestAccess = accessToken
      ? verifySpaceAccessToken(accessToken, space.id).valid
      : false;

    if (!hasGuestAccess) {
      const membership = session
        ? await prisma.membership.findUnique({
            where: { userId_teamId: { teamId, userId: session.user.id } },
          })
        : null;

      if (!membership) {
        // Password gate instead of redirect/404; verify-password route contains leakage.
        return (
          <PrivateSpaceGate isAuthenticated={Boolean(session)} spaceId={space.id} teamId={teamId} />
        );
      }
    }
  }

  const { isArchived, status: teamStatus } = session
    ? await getTeamStatus(session.user.id, teamId)
    : { isArchived: false, status: "none" as TeamStatus };

  const isSpaceOwner = Boolean(session && space && space.ownerId === session.user.id);

  return (
    <TeamPageClient
      isArchived={isArchived}
      isAuthenticated={Boolean(session)}
      spaceId={isSpaceOwner ? (space?.id ?? null) : null}
      teamId={teamId}
      teamStatus={teamStatus}
      userId={session?.user?.id}
    />
  );
};

export default TeamPage;
