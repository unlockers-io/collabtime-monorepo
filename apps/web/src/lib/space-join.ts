import { prisma } from "@repo/db";

import { log } from "@/lib/observability";
import { parseAccessCookies, verifyAccessToken } from "@/lib/workspace-access";

// Capped before the query: an unauthenticated caller controls how many access cookies they send.
const MAX_CANDIDATE_SPACES = 20;

type PrivateSpace = { accessPassword: string | null; id: string; teamId: string };

type MembershipUpsert = {
  create: { role: "MEMBER"; teamId: string; userId: string };
  update: { archivedAt: null };
  where: { userId_teamId: { teamId: string; userId: string } };
};
type ErrorEvent = Parameters<typeof log.error>[0];

type SpaceJoinDeps = {
  findPrivateSpaces: (spaceIds: Array<string>) => Promise<Array<PrivateSpace>>;
  reportError: (event: ErrorEvent) => void;
  upsertMembership: (input: MembershipUpsert) => Promise<void>;
  verifyAccessToken: (token: string, spaceId: string, accessPassword: string | null) => boolean;
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
      const candidates = parseAccessCookies(cookieHeader).slice(0, MAX_CANDIDATE_SPACES);
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
  verifyAccessToken,
});

export { createSpaceJoiner, joinPrivateSpace, joinPrivateSpacesFromCookies };
