import { prisma } from "@repo/db";

import { log } from "@/lib/observability";
import { SPACE_ACCESS_COOKIE_PREFIX, verifySpaceAccessToken } from "@/lib/space-access";

const validSpaceIdsFromCookieHeader = (cookieHeader: string | null): Array<string> => {
  if (!cookieHeader) {
    return [];
  }

  const spaceIds: Array<string> = [];
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
      // Malformed percent-encoding — verify the raw value as-is.
    }
    if (verifySpaceAccessToken(token, spaceId).valid) {
      spaceIds.push(spaceId);
    }
  }
  return spaceIds;
};

// Idempotent via Membership @@unique([userId, teamId]).
const joinPrivateSpace = (userId: string, teamId: string) => {
  return prisma.membership.upsert({
    create: { role: "MEMBER", teamId, userId },
    // Re-activate an archived membership; never demote an existing role.
    update: { archivedAt: null },
    where: { userId_teamId: { teamId, userId } },
  });
};

// Best-effort inside Better Auth's user/session create flow; never throws.
const joinPrivateSpacesFromCookies = async (
  userId: string,
  cookieHeader: string | null,
): Promise<void> => {
  try {
    const spaceIds = validSpaceIdsFromCookieHeader(cookieHeader);
    if (spaceIds.length === 0) {
      return;
    }

    const spaces = await prisma.space.findMany({
      select: { teamId: true },
      where: { id: { in: spaceIds }, isPrivate: true },
    });
    if (spaces.length === 0) {
      return;
    }

    const results = await Promise.allSettled(
      spaces.map((space) => joinPrivateSpace(userId, space.teamId)),
    );

    for (const result of results) {
      if (result.status === "rejected") {
        log.error({
          error: result.reason,
          message: "Failed to materialize private-space membership",
          route: "space-join",
        });
      }
    }
  } catch (error) {
    log.error({ error, message: "Private-space self-join failed", route: "space-join" });
  }
};

export { joinPrivateSpace, joinPrivateSpacesFromCookies };
