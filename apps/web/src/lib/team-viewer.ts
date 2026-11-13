import { prisma } from "@repo/db";

import { displayName, maskEmail } from "@/lib/display-name";
import { isInvitationOpen } from "@/lib/invitation-expiry";
import { type InvitationStore, prismaInvitationStore } from "@/lib/invitations";
import { readTeamAccess, type TeamSpace } from "@/lib/team-auth";
import { normalizeEmail } from "@/lib/validation";
import type { TeamStatus } from "@/types";

type ViewerSession = { user: { email: string; id: string } };

/** Who is looking at a team page: what they may see, and how they relate to the team. */
type Viewer = {
  canView: boolean;
  guestGrant: boolean;
  invitation?: { id: string; inviterName: string };
  inviteMismatch?: { invitedEmailMasked: string };
  isArchived: boolean;
  isOwner: boolean;
  status: TeamStatus;
};

type ViewerDeps = {
  findJoinRequest: (teamId: string, userId: string) => Promise<{ status: string } | null>;
  invitations: Pick<InvitationStore<unknown>, "find" | "listOpenForEmail">;
  readTeamAccess: typeof readTeamAccess;
};

const viewerDeps: ViewerDeps = {
  findJoinRequest: (teamId, userId) =>
    prisma.joinRequest.findUnique({
      select: { status: true },
      where: { userId_teamId: { teamId, userId } },
    }),
  invitations: prismaInvitationStore,
  readTeamAccess,
};

const resolveViewer = async (
  {
    inviteHint,
    session,
    space,
  }: { inviteHint: string | undefined; session: ViewerSession | null; space: TeamSpace },
  deps: ViewerDeps = viewerDeps,
): Promise<Viewer> => {
  const user = session?.user;
  const now = new Date();

  const [access, open, joinRequest] = await Promise.all([
    deps.readTeamAccess(space, user?.id),
    user ? deps.invitations.listOpenForEmail(normalizeEmail(user.email), now) : [],
    user ? deps.findJoinRequest(space.teamId, user.id) : null,
  ]);

  const { canView, guestGrant, isOwner, membership } = access;
  const shared = { canView, guestGrant, isArchived: false, isOwner };

  if (membership !== null) {
    return { ...shared, isArchived: membership.archivedAt !== null, status: membership.role };
  }

  const invited = open.find((invitation) => invitation.teamId === space.teamId);

  if (invited) {
    const inviterName = displayName(invited.invitedBy.name, invited.invitedBy.email);

    return { ...shared, invitation: { id: invited.id, inviterName }, status: "INVITED" };
  }

  const status = joinRequest?.status === "PENDING" ? "PENDING" : "none";
  const hinted = user && inviteHint !== undefined ? await deps.invitations.find(inviteHint) : null;

  const isForSomeoneElse =
    user !== undefined &&
    hinted?.teamId === space.teamId &&
    isInvitationOpen(hinted, now) &&
    normalizeEmail(hinted.email) !== normalizeEmail(user.email);

  return {
    ...shared,
    inviteMismatch: isForSomeoneElse ? { invitedEmailMasked: maskEmail(hinted.email) } : undefined,
    status,
  };
};

export { resolveViewer, viewerDeps };

export type { Viewer, ViewerDeps };
