import crypto from "node:crypto";

import { prisma } from "@repo/db";
import { cookies } from "next/headers";
import { cache } from "react";
import { z } from "zod";

import { displayName } from "@/lib/display-name";
import { isInvitationOpen, maskEmail } from "@/lib/invitations";
import { log } from "@/lib/observability";
import { normalizeEmail } from "@/lib/validation";
import { isTeamRole } from "@/types";
import type { TeamRole, TeamStatus } from "@/types";

const SPACE_ACCESS_COOKIE_PREFIX = "space-access-";
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

// v2 binds the grant to the credential it was issued against.
const TOKEN_VERSION = "v2";

type WorkspaceSpace = {
  accessPassword: string | null;
  id: string;
  isPrivate: boolean;
  teamId: string;
};

type StoredInvitation = {
  email: string;
  expiresAt: Date | null;
  id: string;
  invitedBy: { email: string; name: string | null };
  status: string;
  teamId: string;
};

type StoredMembership = { archivedAt: Date | null; role: string };

type WorkspaceAccessStore = {
  findInvitation: (teamId: string, email: string) => Promise<StoredInvitation | null>;
  findInvitationById: (invitationId: string) => Promise<StoredInvitation | null>;
  findJoinRequest: (teamId: string, userId: string) => Promise<{ status: string } | null>;
  findMembership: (teamId: string, userId: string) => Promise<StoredMembership | null>;
  getToken: (spaceId: string) => Promise<string | undefined>;
};

type ViewerSession = { user: { email: string; id: string } };

type Viewer = {
  canView: boolean;
  guestGrant: boolean;
  invitation?: { id: string; inviterName: string };
  inviteMismatch?: { invitedEmailMasked: string };
  isArchived: boolean;
  isOwner: boolean;
  status: TeamStatus;
};

type AccessCheck = (space: WorkspaceSpace) => Promise<boolean>;

let warnedAboutFallback = false;

const getSigningSecret = (): string => {
  const dedicated = process.env.SPACE_ACCESS_SECRET;

  if (dedicated !== undefined && dedicated !== "") {
    return dedicated;
  }

  const fallback = process.env.BETTER_AUTH_SECRET;

  if (fallback === undefined || fallback === "") {
    throw new Error("Missing SPACE_ACCESS_SECRET or BETTER_AUTH_SECRET environment variable");
  }

  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    log.warn({
      message:
        "SPACE_ACCESS_SECRET not set; signing space tokens with BETTER_AUTH_SECRET. Set a dedicated secret to isolate blast radius.",
      route: "workspace-access",
    });
  }

  return fallback;
};

const createSignature = (data: string, secret: string): string =>
  crypto.createHmac("sha256", secret).update(data).digest("base64url");

const verifySignature = (data: string, signature: string, secret: string): boolean => {
  const expectedSignature = createSignature(data, secret);

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
};

const tokenPayloadSchema = z.object({
  credential: z.string(),
  expiresAt: z.number(),
  spaceId: z.string(),
  version: z.literal(TOKEN_VERSION),
});

/**
 * A fingerprint of the stored hash, not the hash itself: the payload is only
 * base64url, so it is readable by anyone holding the cookie.
 */
const credentialFingerprint = (accessPasswordHash: string, secret: string): string =>
  createSignature(`credential:${accessPasswordHash}`, secret).slice(0, 32);

const createAccessToken = (spaceId: string, accessPasswordHash: string): string => {
  const secret = getSigningSecret();

  const payload: z.infer<typeof tokenPayloadSchema> = {
    credential: credentialFingerprint(accessPasswordHash, secret),
    expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000,
    spaceId,
    version: TOKEN_VERSION,
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${payloadStr}.${createSignature(payloadStr, secret)}`;
};

const verifyAccessToken = (
  token: string,
  spaceId: string,
  accessPasswordHash: string | null,
): boolean => {
  if (accessPasswordHash === null || accessPasswordHash === "") {
    return false;
  }

  try {
    const secret = getSigningSecret();
    const parts = token.split(".");
    const [payloadStr = "", signature = ""] = parts;

    if (
      parts.length !== 2 ||
      payloadStr === "" ||
      signature === "" ||
      !verifySignature(payloadStr, signature, secret)
    ) {
      return false;
    }

    const payload = tokenPayloadSchema.parse(
      JSON.parse(Buffer.from(payloadStr, "base64url").toString("utf8")),
    );

    return (
      payload.spaceId === spaceId &&
      Date.now() <= payload.expiresAt &&
      payload.credential === credentialFingerprint(accessPasswordHash, secret)
    );
  } catch (error) {
    log.error({
      error,
      message: "Space access token verification failed",
      route: "workspace-access",
    });

    return false;
  }
};

const accessCookieName = (spaceId: string): string => `${SPACE_ACCESS_COOKIE_PREFIX}${spaceId}`;

const issueAccessCookie = (spaceId: string, accessPasswordHash: string) => ({
  httpOnly: true,
  maxAge: TOKEN_TTL_SECONDS,
  name: accessCookieName(spaceId),
  sameSite: "lax" as const,
  secure: process.env.WEB_APP_URL?.startsWith("https://") === true,
  value: createAccessToken(spaceId, accessPasswordHash),
});

const parseAccessCookies = (
  cookieHeader: string | null,
): Array<{ spaceId: string; token: string }> => {
  if (cookieHeader === null || cookieHeader === "") {
    return [];
  }

  const accessCookies: Array<{ spaceId: string; token: string }> = [];

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    const name = part.slice(0, Math.max(separatorIndex, 0)).trim();

    if (separatorIndex === -1 || !name.startsWith(SPACE_ACCESS_COOKIE_PREFIX)) {
      continue;
    }

    const rawValue = part.slice(separatorIndex + 1).trim();
    let token = rawValue;

    try {
      token = decodeURIComponent(rawValue);
    } catch {
      // Malformed percent-encoding; verify the raw value as-is.
    }

    accessCookies.push({ spaceId: name.slice(SPACE_ACCESS_COOKIE_PREFIX.length), token });
  }

  return accessCookies;
};

const invitationSelect = {
  email: true,
  expiresAt: true,
  id: true,
  invitedBy: { select: { email: true, name: true } },
  status: true,
  teamId: true,
} as const;

const workspaceAccessStore: WorkspaceAccessStore = {
  findInvitation: (teamId, email) =>
    prisma.invitation.findUnique({
      select: invitationSelect,
      where: { email_teamId: { email, teamId } },
    }),
  findInvitationById: (invitationId) =>
    prisma.invitation.findUnique({ select: invitationSelect, where: { id: invitationId } }),
  findJoinRequest: (teamId, userId) =>
    prisma.joinRequest.findUnique({
      select: { status: true },
      where: { userId_teamId: { teamId, userId } },
    }),
  // Per render: the page and getPublicTeam both ask for the same viewer's membership.
  findMembership: cache((teamId: string, userId: string) =>
    prisma.membership.findUnique({
      select: { archivedAt: true, role: true },
      where: { userId_teamId: { teamId, userId } },
    }),
  ),
  getToken: async (spaceId) => {
    const cookieStore = await cookies();

    return cookieStore.get(accessCookieName(spaceId))?.value;
  },
};

const isMembership = (
  membership: StoredMembership | null,
): membership is StoredMembership & { role: TeamRole } =>
  membership !== null && isTeamRole(membership.role);

const hasGuestGrant = async (space: WorkspaceSpace, store: WorkspaceAccessStore) => {
  if (!space.isPrivate) {
    return false;
  }

  const token = await store.getToken(space.id);

  return token !== undefined && verifyAccessToken(token, space.id, space.accessPassword);
};

const canViewWorkspace = async (
  space: WorkspaceSpace,
  userId: string | undefined,
  store: WorkspaceAccessStore,
): Promise<boolean> => {
  if (!space.isPrivate || (await hasGuestGrant(space, store))) {
    return true;
  }

  return userId !== undefined && isMembership(await store.findMembership(space.teamId, userId));
};

/** Reads the cookie once up front: live-stream rechecks run after the request has ended. */
const captureAccessCheck = async (
  spaceId: string,
  userId: string | undefined,
  store: WorkspaceAccessStore = workspaceAccessStore,
): Promise<AccessCheck> => {
  const token = await store.getToken(spaceId);
  const captured: WorkspaceAccessStore = { ...store, getToken: () => Promise.resolve(token) };

  return (space) => canViewWorkspace(space, userId, captured);
};

type Relation = Pick<Viewer, "invitation" | "isArchived" | "status">;

const STRANGER: Relation = { isArchived: false, status: "none" };

const readRelation = async (
  teamId: string,
  user: ViewerSession["user"],
  store: WorkspaceAccessStore,
): Promise<Relation> => {
  const [membership, invitation, joinRequest] = await Promise.all([
    store.findMembership(teamId, user.id),
    store.findInvitation(teamId, normalizeEmail(user.email)),
    store.findJoinRequest(teamId, user.id),
  ]);

  if (isMembership(membership)) {
    return { isArchived: membership.archivedAt !== null, status: membership.role };
  }

  if (invitation !== null && isInvitationOpen(invitation, new Date())) {
    const inviterName = displayName(invitation.invitedBy.name, invitation.invitedBy.email);

    return { invitation: { id: invitation.id, inviterName }, isArchived: false, status: "INVITED" };
  }

  return { isArchived: false, status: joinRequest?.status === "PENDING" ? "PENDING" : "none" };
};

const findInviteMismatch = async (
  inviteHint: string,
  teamId: string,
  email: string,
  store: WorkspaceAccessStore,
): Promise<Viewer["inviteMismatch"]> => {
  const invitation = await store.findInvitationById(inviteHint);

  if (
    invitation?.teamId !== teamId ||
    !isInvitationOpen(invitation, new Date()) ||
    normalizeEmail(invitation.email) === normalizeEmail(email)
  ) {
    return undefined;
  }

  return { invitedEmailMasked: maskEmail(invitation.email) };
};

const resolveViewer = async (
  {
    inviteHint,
    session,
    space,
  }: {
    inviteHint: string | undefined;
    session: ViewerSession | null;
    space: WorkspaceSpace & { ownerId: string };
  },
  store: WorkspaceAccessStore = workspaceAccessStore,
): Promise<Viewer> => {
  const [guestGrant, relation] = await Promise.all([
    hasGuestGrant(space, store),
    session === null ? STRANGER : readRelation(space.teamId, session.user, store),
  ]);

  const isMember = relation.status === "ADMIN" || relation.status === "MEMBER";
  const isOutsider = relation.status === "none" || relation.status === "PENDING";

  return {
    ...relation,
    canView: !space.isPrivate || guestGrant || isMember,
    guestGrant,
    inviteMismatch:
      session !== null && inviteHint !== undefined && isOutsider
        ? await findInviteMismatch(inviteHint, space.teamId, session.user.email, store)
        : undefined,
    isOwner: session?.user.id === space.ownerId,
  };
};

export {
  canViewWorkspace,
  captureAccessCheck,
  issueAccessCookie,
  parseAccessCookies,
  resolveViewer,
  verifyAccessToken,
  workspaceAccessStore,
};

export type { AccessCheck, WorkspaceAccessStore, WorkspaceSpace };
