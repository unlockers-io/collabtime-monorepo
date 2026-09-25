import { prisma } from "@repo/db";
import { dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AcceptWorkspaceInvitation } from "@/components/accept-workspace-invitation";
import { getPublicTeam } from "@/lib/actions/team-read";
import { getSession } from "@/lib/auth-server";
import { displayName } from "@/lib/display-name";
import { isInvitationOpen, maskEmail } from "@/lib/invitations";
import { createQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { canAccessSpace } from "@/lib/space-visibility";
import { getTeamName } from "@/lib/team-meta";
import { CuidSchema, UUIDSchema, normalizeEmail } from "@/lib/validation";
import { QueryProvider } from "@/providers/query-provider";
import { isTeamRole } from "@/types";
import type { TeamStatus } from "@/types";

import { TeamPageClient } from "./client";
import { PrivateSpaceGate } from "./private-space-gate";

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

type TeamPageProps = {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ invite?: string | Array<string> }>;
};

export const generateMetadata = async ({ params }: TeamPageProps): Promise<Metadata> => {
  const { teamId } = await params;
  const teamName = await getTeamName(teamId);
  const robots = { follow: false, googleBot: { follow: false, index: false }, index: false };

  // A null name is either an unnamed workspace or a dead link; only the latter 404s.
  if (teamName === null && UUIDSchema.safeParse(teamId).success) {
    const space = await prisma.space.findUnique({ select: { id: true }, where: { teamId } });
    if (!space) {
      return { robots, title: "Workspace not found" };
    }
  }

  return {
    description: `Working hours and overlap view for ${teamName ?? "your team"}.`,
    robots,
    title: teamName ?? "Untitled workspace",
  };
};

type TeamStatusResult = {
  invitationId?: string;
  inviterName?: string;
  isArchived: boolean;
  status: TeamStatus;
};

const GUEST_STATUS: TeamStatusResult = { isArchived: false, status: "none" };

/**
 * Promise.all, not allSettled: folding a rejected membership query into `null`
 * reported a real member as "none", which the client then papered over by
 * re-running the same query.
 */
const getTeamStatus = async (
  session: Session | null,
  teamId: string,
): Promise<TeamStatusResult> => {
  if (!session) {
    return GUEST_STATUS;
  }
  const { email, id: userId } = session.user;
  const [membership, invitation, joinRequest] = await Promise.all([
    prisma.membership.findUnique({
      where: { userId_teamId: { teamId, userId } },
    }),
    prisma.invitation.findUnique({
      include: { invitedBy: { select: { email: true, name: true } } },
      where: { email_teamId: { email: normalizeEmail(email), teamId } },
    }),
    prisma.joinRequest.findUnique({
      where: { userId_teamId: { teamId, userId } },
    }),
  ]);

  if (membership && isTeamRole(membership.role)) {
    return { isArchived: membership.archivedAt !== null, status: membership.role };
  }

  if (invitation && isInvitationOpen(invitation, new Date())) {
    return {
      invitationId: invitation.id,
      inviterName: displayName(invitation.invitedBy.name, invitation.invitedBy.email),
      isArchived: false,
      status: "INVITED",
    };
  }

  if (joinRequest?.status === "PENDING") {
    return { isArchived: false, status: "PENDING" };
  }

  return { isArchived: false, status: "none" };
};

const findInviteMismatch = async (
  session: Session | null,
  teamId: string,
  teamStatus: TeamStatus,
  invitationId: string | undefined,
): Promise<{ invitedEmailMasked: string } | undefined> => {
  if (
    !session ||
    invitationId === undefined ||
    (teamStatus !== "none" && teamStatus !== "PENDING")
  ) {
    return undefined;
  }
  const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (
    invitation?.teamId !== teamId ||
    !isInvitationOpen(invitation, new Date()) ||
    normalizeEmail(invitation.email) === normalizeEmail(session.user.email)
  ) {
    return undefined;
  }
  return { invitedEmailMasked: maskEmail(invitation.email) };
};

const TeamPage = async ({ params, searchParams }: TeamPageProps) => {
  const { teamId } = await params;

  const query = await searchParams;
  const invite = CuidSchema.safeParse(query.invite);
  const returnTo = `/${teamId}${invite.success ? `?invite=${invite.data}` : ""}`;

  const [session, space] = await Promise.all([
    getSession(),
    prisma.space.findUnique({ where: { teamId } }),
  ]);

  if (!space) {
    notFound();
  }

  const {
    invitationId,
    inviterName,
    isArchived,
    status: teamStatus,
  } = await getTeamStatus(session, teamId);

  const teamName = (await getTeamName(teamId)) ?? "Untitled workspace";
  const inviteMismatch = await findInviteMismatch(session, teamId, teamStatus, invite.data);

  if (space.isPrivate && teamStatus === "INVITED" && invitationId !== undefined) {
    return (
      <main
        className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-20"
        id="main"
      >
        <h1 className="font-display text-2xl font-semibold">Join this workspace</h1>
        <div className="border-y border-border py-6">
          <AcceptWorkspaceInvitation
            invitationId={invitationId}
            inviterName={inviterName}
            teamName={teamName}
          />
        </div>
      </main>
    );
  }

  if (!(await canAccessSpace(space, session?.user.id))) {
    return (
      <PrivateSpaceGate
        inviteMismatch={inviteMismatch}
        isAuthenticated={Boolean(session)}
        returnTo={returnTo}
        spaceId={space.id}
        teamId={teamId}
      />
    );
  }

  const isSpaceOwner = Boolean(session && space.ownerId === session.user.id);
  const queryClient = createQueryClient();
  const teamResult = await getPublicTeam(teamId);

  if (teamResult.success) {
    queryClient.setQueryData(queryKeys.teams.detail(teamId), { team: teamResult.data.team });
  }

  return (
    <QueryProvider dehydratedState={dehydrate(queryClient)}>
      <TeamPageClient
        hasPassword={isSpaceOwner ? Boolean(space.accessPassword) : undefined}
        invitationId={invitationId}
        inviteMismatch={inviteMismatch}
        inviterName={inviterName}
        isArchived={isArchived}
        isAuthenticated={Boolean(session)}
        isPrivate={space.isPrivate}
        returnTo={returnTo}
        spaceId={isSpaceOwner ? space.id : null}
        teamId={teamId}
        teamStatus={teamStatus}
        userId={session?.user.id}
      />
    </QueryProvider>
  );
};

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export default TeamPage;
