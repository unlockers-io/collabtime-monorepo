import { type InvitationStatus, type Prisma, prisma } from "@repo/db";
import type { TransactionalEmail } from "@repo/transactional";
import { after } from "next/server";

import type { ActionErrorEvent, ActionResult } from "@/lib/actions/types";
import type { PendingTeamInvitation, TeamRecord } from "@/types";

import { getAppUrl } from "./app-url";
import { displayName } from "./display-name";
import { INVITATION_TTL_DAYS, INVITES_PER_TEAM_PER_DAY, INVITES_PER_USER_PER_HOUR } from "./limits";
import { sendAppEmail } from "./mailer";
import {
  type GrantMembership,
  grantMembership,
  type MembershipGrant,
  membershipUpsert,
} from "./membership";
import { log } from "./observability";
import { checkRateLimit } from "./space-rate-limit";
import type { SessionUser, TeamAccess } from "./team-auth";
import { teamNotifier } from "./team-notifier";
import { readTeamRecord } from "./team-store";
import { CuidSchema, InvitationEmailSchema, normalizeEmail, UUIDSchema } from "./validation";

type Person = { email: string; name: string | null };

type Decision = "accepted" | "declined";

type StoredInvitation = {
  createdAt: Date;
  email: string;
  expiresAt: Date | null;
  id: string;
  invitedBy: Person;
  memberId: string;
  status: InvitationStatus;
  teamId: string;
  updatedAt: Date;
};

type PendingDraft = Pick<StoredInvitation, "email" | "memberId" | "teamId"> & {
  expiresAt: Date;
  invitedBy: Person & { id: string };
};

type InvitationChange<TTransaction> =
  | { expiresAt: Date; status: "PENDING" }
  | {
      memberId: string;
      membership: MembershipGrant;
      status: "ACCEPTED";
      transaction: TTransaction;
    }
  | { status: "DECLINED" }
  | { status: "REVOKED" };

type InvitationStore<TTransaction> = {
  find: (id: string) => Promise<StoredInvitation | null>;
  listOpenForEmail: (email: string, now: Date) => Promise<Array<StoredInvitation>>;
  listPendingForTeam: (teamId: string) => Promise<Array<StoredInvitation>>;
  /** Makes the address's invitation to the team pending again, replacing any earlier one in any state. */
  putPending: (draft: PendingDraft) => Promise<StoredInvitation>;
  /**
   * Compares status and version; recipient decisions also require an unexpired invitation at the write.
   * Acceptance grants membership in the supplied transaction. Admin changes may renew/revoke expired rows.
   */
  transition: (
    expected: StoredInvitation,
    change: InvitationChange<TTransaction>,
  ) => Promise<boolean>;
};

type InvitationDeps<TTransaction> = {
  appUrl: () => string;
  checkRateLimit: typeof checkRateLimit;
  grantMembership: GrantMembership<TTransaction>;
  isMember: (teamId: string, email: string) => Promise<boolean>;
  notifyInviter: (invitation: StoredInvitation, user: Person, decision: Decision) => void;
  now: () => Date;
  readTeamRecord: (teamId: string) => Promise<TeamRecord | null>;
  reportError: (event: ActionErrorEvent) => void;
  sendEmail: (email: TransactionalEmail) => Promise<{ sent: boolean }>;
  store: InvitationStore<TTransaction>;
};

type Failure = Extract<ActionResult<never>, { success: false }>;

const HOUR_SECONDS = 3600;
const DAY_SECONDS = 24 * HOUR_SECONDS;
const INVITATION_EXPIRED_ERROR = "This invitation has expired. Ask a workspace admin to resend it.";
const NOT_PENDING_ERROR = "This invitation is no longer pending";
const RATE_LIMITED_ERROR = "Too many invitations. Try again later.";
const STALE_ERROR = "Could not update this invitation. Refresh and try again.";

const failure = (error: string): Failure => ({ error, success: false });

const isInvitationExpired = (invitation: { expiresAt: Date | null }, now: Date): boolean =>
  invitation.expiresAt !== null && invitation.expiresAt <= now;

/** Pending and unexpired; legacy invitations without an expiry stay open. */
const isInvitationOpen = (
  invitation: { expiresAt: Date | null; status: string },
  now: Date,
): boolean => invitation.status === "PENDING" && !isInvitationExpired(invitation, now);

const openInvitationWhere = (now: Date) => ({
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  status: "PENDING" as const,
});

const invitationExpiryFrom = (now: Date): Date =>
  new Date(now.getTime() + INVITATION_TTL_DAYS * DAY_SECONDS * 1000);

const maskEmail = (email: string): string => {
  const [local = "", domain = ""] = email.split("@");

  return `${local.slice(0, 1)}***@${domain}`;
};

const inviteLink = (appUrl: string, teamId: string, invitationId: string): string => {
  const url = new URL(`/${teamId}`, appUrl);
  url.searchParams.set("invite", invitationId);

  return url.toString();
};

/** The recipient decides only while the invitation is open. */
const recipientRefusal = (invitation: StoredInvitation, email: string, now: Date) => {
  if (normalizeEmail(invitation.email) !== normalizeEmail(email)) {
    return "This invitation is not for you";
  }

  if (invitation.status !== "PENDING") {
    return NOT_PENDING_ERROR;
  }

  return isInvitationExpired(invitation, now) ? INVITATION_EXPIRED_ERROR : null;
};

const toTeamView = (invitation: StoredInvitation): PendingTeamInvitation => ({
  createdAt: invitation.createdAt.toISOString(),
  email: invitation.email,
  expiresAt: invitation.expiresAt?.toISOString() ?? null,
  id: invitation.id,
  memberId: invitation.memberId,
});

const createInvitations = <TTransaction>(deps: InvitationDeps<TTransaction>) => {
  const guarded = async <TValue>(
    event: { invitationId?: string; message: string },
    fallback: string,
    run: () => Promise<ActionResult<TValue>>,
  ): Promise<ActionResult<TValue>> => {
    try {
      return await run();
    } catch (error) {
      deps.reportError({ ...event, error, route: "lib/invitations" });

      return failure(fallback);
    }
  };

  const move = async (expected: StoredInvitation, change: InvitationChange<TTransaction>) => {
    if (!(await deps.store.transition(expected, change))) {
      throw new Error("The invitation changed after it was read");
    }
  };

  // Invites and resends share both limits.
  const allowSend = async (userId: string, teamId: string): Promise<boolean> => {
    const user = await deps.checkRateLimit(
      `invite:user:${userId}`,
      INVITES_PER_USER_PER_HOUR,
      HOUR_SECONDS,
    );

    if (!user.allowed) {
      return false;
    }

    const team = await deps.checkRateLimit(
      `invite:team:${teamId}`,
      INVITES_PER_TEAM_PER_DAY,
      DAY_SECONDS,
    );

    return team.allowed;
  };

  const sendInvitation = (invitation: StoredInvitation, teamName: string, expiresAt: Date) =>
    deps.sendEmail({
      expiresAt: expiresAt.toISOString(),
      inviterName: displayName(invitation.invitedBy.name, invitation.invitedBy.email),
      recipientEmail: invitation.email,
      teamId: invitation.teamId,
      teamName,
      teamUrl: inviteLink(deps.appUrl(), invitation.teamId, invitation.id),
      type: "invitation",
    });

  const findForRecipient = async (
    user: SessionUser,
    invitationId: string,
  ): Promise<ActionResult<StoredInvitation>> => {
    if (!CuidSchema.safeParse(invitationId).success) {
      return failure("Invalid invitation ID");
    }

    const invitation = await deps.store.find(invitationId);

    if (!invitation) {
      return failure("Invitation not found");
    }

    const refusal = recipientRefusal(invitation, user.email, deps.now());

    return refusal === null ? { data: invitation, success: true } : failure(refusal);
  };

  const findForAdmin = async (
    access: TeamAccess,
    invitationId: string,
  ): Promise<ActionResult<StoredInvitation>> => {
    if (!CuidSchema.safeParse(invitationId).success) {
      return failure("Invalid invitation ID");
    }

    const invitation = await deps.store.find(invitationId);

    if (invitation?.teamId !== access.teamId) {
      return failure("Invitation not found");
    }

    // Admins may revoke or renew pending invitations even after they expire.
    return invitation.status === "PENDING"
      ? { data: invitation, success: true }
      : failure(NOT_PENDING_ERROR);
  };

  const invite = (access: TeamAccess, request: { email: string; memberId: string }) =>
    guarded({ message: "Failed to invite member" }, "Failed to send invitation", async () => {
      const { teamId, user } = access;

      if (!UUIDSchema.safeParse(request.memberId).success) {
        return failure("Invalid member ID");
      }

      const email = normalizeEmail(request.email);

      if (!InvitationEmailSchema.safeParse(email).success) {
        return failure("Invalid email address");
      }

      const [team, isMember] = await Promise.all([
        deps.readTeamRecord(teamId),
        deps.isMember(teamId, email),
      ]);

      if (!team) {
        return failure("Team not found");
      }

      const slot = team.members.find((member) => member.id === request.memberId);

      if (!slot) {
        return failure("Member not found");
      }

      if (slot.userId !== undefined && slot.userId !== "") {
        return failure("This member slot is already claimed");
      }

      if (isMember) {
        return failure("This user is already a member of the team");
      }

      if (!(await allowSend(user.id, teamId))) {
        return failure(RATE_LIMITED_ERROR);
      }

      const expiresAt = invitationExpiryFrom(deps.now());

      const invitation = await deps.store.putPending({
        email,
        expiresAt,
        invitedBy: user,
        memberId: request.memberId,
        teamId,
      });

      const { sent } = await sendInvitation(invitation, team.name, expiresAt);

      return { data: { emailSent: sent, invitationId: invitation.id }, success: true };
    });

  const accept = (user: SessionUser, invitationId: string) =>
    guarded<{ teamId: string }>(
      { invitationId, message: "Failed to accept invitation" },
      STALE_ERROR,
      async () => {
        const found = await findForRecipient(user, invitationId);

        if (!found.success) {
          return found;
        }

        const invitation = found.data;

        const granted = await deps.grantMembership({
          commit: (membership, memberId, transaction) =>
            move(invitation, { memberId, membership, status: "ACCEPTED", transaction }),
          role: "MEMBER",
          slot: { memberId: invitation.memberId, name: displayName(user.name, user.email) },
          teamId: invitation.teamId,
          userId: user.id,
        });

        if (!granted.ok) {
          return failure(granted.error);
        }

        deps.notifyInviter(invitation, user, "accepted");

        return { data: { teamId: invitation.teamId }, success: true };
      },
    );

  const decline = (user: SessionUser, invitationId: string) =>
    guarded<undefined>(
      { invitationId, message: "Failed to decline invitation" },
      STALE_ERROR,
      async () => {
        const found = await findForRecipient(user, invitationId);

        if (!found.success) {
          return found;
        }

        await move(found.data, { status: "DECLINED" });
        deps.notifyInviter(found.data, user, "declined");

        return { data: undefined, success: true };
      },
    );

  const revoke = (access: TeamAccess, invitationId: string) =>
    guarded<undefined>(
      { invitationId, message: "Failed to revoke invitation" },
      STALE_ERROR,
      async () => {
        const found = await findForAdmin(access, invitationId);

        if (!found.success) {
          return found;
        }

        await move(found.data, { status: "REVOKED" });

        return { data: undefined, success: true };
      },
    );

  const resend = (access: TeamAccess, invitationId: string) =>
    guarded<{ emailSent: boolean }>(
      { invitationId, message: "Failed to resend invitation" },
      STALE_ERROR,
      async () => {
        const found = await findForAdmin(access, invitationId);

        if (!found.success) {
          return found;
        }

        const team = await deps.readTeamRecord(access.teamId);

        if (!team) {
          return failure("Team not found");
        }

        if (!(await allowSend(access.user.id, access.teamId))) {
          return failure(RATE_LIMITED_ERROR);
        }

        const expiresAt = invitationExpiryFrom(deps.now());
        await move(found.data, { expiresAt, status: "PENDING" });
        const { sent } = await sendInvitation(found.data, team.name, expiresAt);

        return { data: { emailSent: sent }, success: true };
      },
    );

  // Expired invitations stay listed so admins can resend or revoke them.
  const listForTeam = (access: TeamAccess) =>
    guarded({ message: "Failed to list invitations" }, "Failed to get invitations", async () => {
      const invitations = await deps.store.listPendingForTeam(access.teamId);

      return { data: invitations.map(toTeamView), success: true };
    });

  const listOpenForEmail = (email: string) =>
    deps.store.listOpenForEmail(normalizeEmail(email), deps.now());

  return { accept, decline, invite, listForTeam, listOpenForEmail, resend, revoke };
};

const include = { invitedBy: { select: { email: true, name: true } } };
const newestFirst = { createdAt: "desc" as const };

const commitRecipientDecision = async (
  transaction: Prisma.TransactionClient,
  { id, memberId, status, updatedAt }: StoredInvitation,
  change: Extract<InvitationChange<Prisma.TransactionClient>, { status: "ACCEPTED" | "DECLINED" }>,
): Promise<boolean> => {
  if (status !== "PENDING") {
    return false;
  }

  // Take the row lock before checking the clock: UPDATE predicates can run before a lock wait.
  await transaction.$executeRaw`SELECT "id" FROM "Invitation" WHERE "id" = ${id} FOR UPDATE`;

  const count = await transaction.$executeRaw`
      UPDATE "Invitation"
      SET "status" = ${change.status}::"InvitationStatus",
          "memberId" = ${change.status === "ACCEPTED" ? change.memberId : memberId},
          "updatedAt" = GREATEST(date_trunc('milliseconds', clock_timestamp()), "updatedAt" + interval '1 millisecond')
      WHERE "id" = ${id} AND "status" = ${status}::"InvitationStatus" AND "updatedAt" = ${updatedAt}
        AND ("expiresAt" IS NULL OR "expiresAt" > clock_timestamp())
    `;

  if (count === 1 && change.status === "ACCEPTED") {
    await transaction.membership.upsert(membershipUpsert(change.membership));
  }

  return count === 1;
};

const prismaInvitationStore: InvitationStore<Prisma.TransactionClient> = {
  find: (id) => prisma.invitation.findUnique({ include, where: { id } }),
  listOpenForEmail: (email, now) =>
    prisma.invitation.findMany({
      include,
      orderBy: newestFirst,
      where: { email, ...openInvitationWhere(now) },
    }),
  listPendingForTeam: (teamId) =>
    prisma.invitation.findMany({
      include,
      orderBy: newestFirst,
      where: { status: "PENDING", teamId },
    }),
  putPending: ({ invitedBy, ...draft }) =>
    prisma.invitation.upsert({
      create: { ...draft, invitedById: invitedBy.id },
      include,
      update: { ...draft, invitedById: invitedBy.id, status: "PENDING" },
      where: { email_teamId: { email: draft.email, teamId: draft.teamId } },
    }),
  transition: async (expected, change) => {
    const { id, status, updatedAt } = expected;

    if (change.status === "PENDING" || change.status === "REVOKED") {
      const nextVersion = new Date(Math.max(Date.now(), updatedAt.getTime() + 1));

      const { count } = await prisma.invitation.updateMany({
        data: { ...change, updatedAt: nextVersion },
        where: { id, status, updatedAt },
      });

      return count === 1;
    }

    return change.status === "ACCEPTED"
      ? commitRecipientDecision(change.transaction, expected, change)
      : prisma.$transaction((transaction) =>
          commitRecipientDecision(transaction, expected, change),
        );
  },
};

const invitations = createInvitations({
  appUrl: getAppUrl,
  checkRateLimit,
  grantMembership,
  isMember: async (teamId, email) =>
    (await prisma.membership.findFirst({ where: { teamId, user: { email } } })) !== null,
  notifyInviter: (invitation, user, decision) => {
    after(() => teamNotifier.notifyInviterOfDecision(invitation, user, decision));
  },
  now: () => new Date(),
  readTeamRecord,
  reportError: log.error,
  sendEmail: sendAppEmail,
  store: prismaInvitationStore,
});

export {
  createInvitations,
  INVITATION_EXPIRED_ERROR,
  invitations,
  isInvitationOpen,
  maskEmail,
  openInvitationWhere,
  prismaInvitationStore,
};

export type { InvitationDeps, InvitationStore, StoredInvitation };
