import { db, membership as membershipTable, space as spaceTable } from "@repo/db";
import { and, eq, inArray } from "drizzle-orm";

import { log } from "@/lib/observability";
import { SPACE_ACCESS_COOKIE_PREFIX, verifySpaceAccessToken } from "@/lib/space-access";

/**
 * Read every `space-access-*` cookie from a raw Cookie header and return the
 * spaceIds whose tokens are valid (signed, unexpired, matching the spaceId in
 * the cookie name). Forged or mismatched cookies fail verification and are
 * dropped.
 */
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

/**
 * Upsert a durable MEMBER membership for a private team. A correct password is
 * the authorization for a private space, so this grants access without admin
 * approval.
 *
 * Idempotent via the Membership @@unique([userId, teamId]) constraint: an
 * existing membership is left untouched except that an archived one is
 * re-activated (a password join brings a removed member back in). ADMIN rows
 * keep their role.
 */
const joinPrivateSpace = (userId: string, teamId: string) => {
  return (
    db
      .insert(membershipTable)
      .values({
        id: crypto.randomUUID(),
        role: "MEMBER",
        teamId,
        updatedAt: new Date().toISOString(),
        userId,
      })
      // Re-activate an archived membership; never demote an existing role.
      .onConflictDoUpdate({
        set: { archivedAt: null },
        target: [membershipTable.userId, membershipTable.teamId],
      })
      .returning()
  );
};

/**
 * Materialize durable memberships for a user from the private-space-access
 * cookies they carry. Used by the auth lifecycle hooks at signup/login.
 *
 * Best-effort: this runs inside Better Auth's user/session create flow, so it
 * never throws — failures are logged and swallowed.
 */
const joinPrivateSpacesFromCookies = async (
  userId: string,
  cookieHeader: string | null,
): Promise<void> => {
  try {
    const spaceIds = validSpaceIdsFromCookieHeader(cookieHeader);
    if (spaceIds.length === 0) {
      return;
    }

    const spaces = await db.query.space.findMany({
      columns: { teamId: true },
      where: and(inArray(spaceTable.id, spaceIds), eq(spaceTable.isPrivate, true)),
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
