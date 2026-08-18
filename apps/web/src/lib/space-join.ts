import { prisma } from "@repo/db";

import { log } from "@/lib/observability";
import { SPACE_ACCESS_COOKIE_PREFIX, verifySpaceAccessToken } from "@/lib/space-access";

// Verification now needs each space's current password hash, so candidates are
// read from the header first and the query is what proves them. Capped because
// an unauthenticated caller controls how many space-access-* cookies they send,
// and the cap is applied before the query rather than after.
const MAX_CANDIDATE_SPACES = 20;

type SpaceAccessCandidate = { spaceId: string; token: string };

type PrivateSpace = { accessPassword: string | null; id: string; teamId: string };

type MembershipUpsert = {
  create: { role: "MEMBER"; teamId: string; userId: string };
  update: { archivedAt: null };
  where: { userId_teamId: { teamId: string; userId: string } };
};

type SpaceJoinDeps = {
  findPrivateSpaces: (spaceIds: Array<string>) => Promise<Array<PrivateSpace>>;
  reportError: (event: Record<string, unknown>) => void;
  upsertMembership: (input: MembershipUpsert) => Promise<void>;
  verifyAccessToken: (token: string, spaceId: string, accessPassword: string | null) => boolean;
};

const spaceAccessCandidates = (cookieHeader: string | null): Array<SpaceAccessCandidate> => {
  if (cookieHeader === null || cookieHeader === "") {
    return [];
  }

  const candidates: Array<SpaceAccessCandidate> = [];
  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const name = part.slice(0, separatorIndex).trim();
    if (!name.startsWith(SPACE_ACCESS_COOKIE_PREFIX)) {
      continue;
    }
    const spaceId = name.slice(SPACE_ACCESS_COOKIE_PREFIX.length);
    const rawValue = part.slice(separatorIndex + 1).trim();
    let token = rawValue;
    try {
      token = decodeURIComponent(rawValue);
    } catch {
      // Malformed percent-encoding; verify the raw value as-is.
    }
    candidates.push({ spaceId, token });
    if (candidates.length >= MAX_CANDIDATE_SPACES) {
      break;
    }
  }
  return candidates;
};

const createSpaceJoiner = (deps: SpaceJoinDeps) => {
  const joinPrivateSpace = (userId: string, teamId: string) => {
    return deps.upsertMembership({
      create: { role: "MEMBER", teamId, userId },
      update: { archivedAt: null },
      where: { userId_teamId: { teamId, userId } },
    });
  };

  const joinPrivateSpacesFromCookies = async (
    userId: string,
    cookieHeader: string | null,
  ): Promise<void> => {
    try {
      const candidates = spaceAccessCandidates(cookieHeader);
      if (candidates.length === 0) {
        return;
      }

      const spaces = await deps.findPrivateSpaces(candidates.map((candidate) => candidate.spaceId));
      if (spaces.length === 0) {
        return;
      }

      const tokenBySpaceId = new Map(
        candidates.map((candidate) => [candidate.spaceId, candidate.token]),
      );

      const granted = spaces.filter((space) => {
        const token = tokenBySpaceId.get(space.id);
        return token !== undefined && deps.verifyAccessToken(token, space.id, space.accessPassword);
      });
      if (granted.length === 0) {
        return;
      }

      const results = await Promise.allSettled(
        granted.map((space) => joinPrivateSpace(userId, space.teamId)),
      );

      for (const result of results) {
        if (result.status === "rejected") {
          deps.reportError({
            error: result.reason,
            message: "Failed to materialize private-space membership",
            route: "space-join",
          });
        }
      }
    } catch (error) {
      deps.reportError({ error, message: "Private-space self-join failed", route: "space-join" });
    }
  };

  return { joinPrivateSpace, joinPrivateSpacesFromCookies };
};

const { joinPrivateSpace, joinPrivateSpacesFromCookies } = createSpaceJoiner({
  findPrivateSpaces: (spaceIds) =>
    prisma.space.findMany({
      select: { accessPassword: true, id: true, teamId: true },
      where: { id: { in: spaceIds }, isPrivate: true },
    }),
  reportError: log.error,
  upsertMembership: async (input) => {
    await prisma.membership.upsert(input);
  },
  verifyAccessToken: (token, spaceId, accessPassword) =>
    verifySpaceAccessToken(token, spaceId, accessPassword).valid,
});

export { createSpaceJoiner, joinPrivateSpace, joinPrivateSpacesFromCookies };
