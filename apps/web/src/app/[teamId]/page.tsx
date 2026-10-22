import { prisma } from "@repo/db";
import { dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AcceptWorkspaceInvitation } from "@/components/accept-workspace-invitation";
import { getPublicTeam } from "@/lib/actions/team-read";
import { getSession } from "@/lib/auth-server";
import { createQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { getTeamName } from "@/lib/team-meta";
import { CuidSchema, UUIDSchema } from "@/lib/validation";
import { resolveViewer } from "@/lib/workspace-access";
import { QueryProvider } from "@/providers/query-provider";

import { TeamPageClient } from "./client";
import { PrivateSpaceGate } from "./private-space-gate";

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

  const viewer = await resolveViewer({ inviteHint: invite.data, session, space });
  const teamName = (await getTeamName(teamId)) ?? "Untitled workspace";

  if (space.isPrivate && viewer.invitation !== undefined) {
    return (
      <main
        className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-20"
        id="main"
      >
        <h1 className="font-display text-2xl font-semibold">Join this workspace</h1>
        <div className="border-y border-border py-6">
          <AcceptWorkspaceInvitation
            invitationId={viewer.invitation.id}
            inviterName={viewer.invitation.inviterName}
            teamName={teamName}
          />
        </div>
      </main>
    );
  }

  if (!viewer.canView) {
    return (
      <PrivateSpaceGate
        inviteMismatch={viewer.inviteMismatch}
        isAuthenticated={Boolean(session)}
        returnTo={returnTo}
        spaceId={space.id}
        teamId={teamId}
      />
    );
  }

  const queryClient = createQueryClient();
  const teamResult = await getPublicTeam(teamId);

  if (teamResult.success) {
    queryClient.setQueryData(queryKeys.teams.detail(teamId), { team: teamResult.data.team });
  }

  return (
    <QueryProvider dehydratedState={dehydrate(queryClient)}>
      <TeamPageClient
        hasPassword={viewer.isOwner ? Boolean(space.accessPassword) : undefined}
        invitationId={viewer.invitation?.id}
        inviteMismatch={viewer.inviteMismatch}
        inviterName={viewer.invitation?.inviterName}
        isArchived={viewer.isArchived}
        isAuthenticated={Boolean(session)}
        isPrivate={space.isPrivate}
        returnTo={returnTo}
        spaceId={viewer.isOwner ? space.id : null}
        teamId={teamId}
        teamStatus={viewer.status}
        userId={session?.user.id}
      />
    </QueryProvider>
  );
};

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export default TeamPage;
