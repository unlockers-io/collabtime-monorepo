import { prisma } from "@repo/db";

import { log } from "@/lib/observability";
import { parseAccessCookies, verifyAccessToken } from "@/lib/workspace-access";

import { type GrantMembership, grantMembership } from "./membership";

// Capped before the query: an unauthenticated caller controls how many access cookies they send.
const MAX_CANDIDATE_SPACES = 20;

type PrivateSpace = { accessPassword: string | null; id: string; teamId: string };

type ErrorEvent = Parameters<typeof log.error>[0];

type SpaceJoinDeps = {
  findPrivateSpaces: (spaceIds: Array<string>) => Promise<Array<PrivateSpace>>;
  grantMembership: GrantMembership;
  reportError: (event: ErrorEvent) => void;
  verifyAccessToken: (token: string, spaceId: string, accessPassword: string | null) => boolean;
};

const createSpaceJoiner = (deps: SpaceJoinDeps) => {
  const joinPrivateSpace = (userId: string, teamId: string) =>
    // Password viewers stay off the roster until they add their own profile.
    deps.grantMembership({ role: "MEMBER", slot: null, teamId, userId });

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
  grantMembership,
  reportError: log.error,
  verifyAccessToken,
});

export { createSpaceJoiner, joinPrivateSpace, joinPrivateSpacesFromCookies };
