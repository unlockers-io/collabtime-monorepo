import { prisma } from "@repo/db";
import { dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getPublicTeam } from "@/lib/actions/team-read";
import { getSession } from "@/lib/auth-server";
import { createQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { SPACE_ACCESS_COOKIE_PREFIX, verifySpaceAccessToken } from "@/lib/space-access";
import { getTeamName } from "@/lib/team-meta";
import { QueryProvider } from "@/providers/query-provider";
import { isTeamRole } from "@/types";
import type { TeamStatus } from "@/types";

import { TeamPageClient } from "./client";
import Loading from "./loading";
import { PrivateSpaceGate } from "./private-space-gate";

type TeamPageProps = {
  params: Promise<{ teamId: string }>;
};

export const generateMetadata = async ({ params }: TeamPageProps): Promise<Metadata> => {
  const { teamId } = await params;
  const teamName = await getTeamName(teamId);

  return {
    description: `Working hours and overlap view for ${teamName ?? "your team"}.`,
    title: teamName ?? "Team Workspace",
  };
};

type TeamStatusResult = {
  isArchived: boolean;
  status: TeamStatus;
};

const GUEST_STATUS: TeamStatusResult = { isArchived: false, status: "none" };

/**
 * Promise.all, not allSettled: folding a rejected membership query into `null`
 * reported a real member as "none", which the client then papered over by
 * re-running the same query.
 */
const getTeamStatus = async (userId: string, teamId: string): Promise<TeamStatusResult> => {
  const [membership, joinRequest] = await Promise.all([
    prisma.membership.findUnique({
      where: { userId_teamId: { teamId, userId } },
    }),
    prisma.joinRequest.findUnique({
      where: { userId_teamId: { teamId, userId } },
    }),
  ]);

  if (membership && isTeamRole(membership.role)) {
    return { isArchived: membership.archivedAt !== null, status: membership.role };
  }

  if (joinRequest?.status === "PENDING") {
    return { isArchived: false, status: "PENDING" };
  }

  return { isArchived: false, status: "none" };
};

const TeamPageContent = async ({ params }: TeamPageProps) => {
  const { teamId } = await params;

  const [sessionResult, spaceResult] = await Promise.allSettled([
    getSession(),
    prisma.space.findUnique({ where: { teamId } }),
  ]);

  const session = sessionResult.status === "fulfilled" ? sessionResult.value : null;
  const space = spaceResult.status === "fulfilled" ? spaceResult.value : null;

  if (!space) {
    notFound();
  }

  if (space.isPrivate) {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(`${SPACE_ACCESS_COOKIE_PREFIX}${space.id}`)?.value;
    const hasGuestAccess =
      accessToken !== undefined && accessToken !== ""
        ? verifySpaceAccessToken(accessToken, space.id, space.accessPassword).valid
        : false;

    if (!hasGuestAccess) {
      const membership = session
        ? await prisma.membership.findUnique({
            where: { userId_teamId: { teamId, userId: session.user.id } },
          })
        : null;

      if (!membership) {
        return (
          <PrivateSpaceGate isAuthenticated={Boolean(session)} spaceId={space.id} teamId={teamId} />
        );
      }
    }
  }

  const { isArchived, status: teamStatus } = session
    ? await getTeamStatus(session.user.id, teamId)
    : GUEST_STATUS;

  const isSpaceOwner = Boolean(session && space.ownerId === session.user.id);
  const queryClient = createQueryClient();
  const teamResult = await getPublicTeam(teamId);

  if (teamResult.success) {
    queryClient.setQueryData(queryKeys.teams.detail(teamId), { team: teamResult.data.team });
  }

  return (
    <QueryProvider dehydratedState={dehydrate(queryClient)}>
      <TeamPageClient
        isArchived={isArchived}
        isAuthenticated={Boolean(session)}
        spaceId={isSpaceOwner ? space.id : null}
        teamId={teamId}
        teamStatus={teamStatus}
        userId={session?.user?.id}
      />
    </QueryProvider>
  );
};

const TeamPage = ({ params }: TeamPageProps) => (
  <Suspense fallback={<Loading />}>
    <TeamPageContent params={params} />
  </Suspense>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export default TeamPage;
