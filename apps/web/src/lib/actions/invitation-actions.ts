"use server";

import {
  db,
  invitation as invitationTable,
  membership as membershipTable,
  user as userTable,
} from "@repo/db";
import { sendInvitationEmail } from "@repo/transactional";
import { and, eq } from "drizzle-orm";
import { after } from "next/server";

import { getEnv } from "@/lib/env";
import { log } from "@/lib/observability";
import { requireAuth, requireTeamAdmin } from "@/lib/team-auth";

import { redis, TEAM_ACTIVE_TTL_SECONDS } from "../redis";
import { UUIDSchema } from "../validation";

import { getTeamRecord } from "./helpers";
import type { ActionResult } from "./types";

const inviteMember = async (
  teamId: string,
  memberId: string,
  email: string,
): Promise<ActionResult<{ emailSent: boolean; invitationId: string }>> => {
  try {
    const session = await requireAuth();
    await requireTeamAdmin(teamId);

    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { error: "Invalid team ID", success: false };
    }

    const memberIdResult = UUIDSchema.safeParse(memberId);
    if (!memberIdResult.success) {
      return { error: "Invalid member ID", success: false };
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/v.test(trimmedEmail)) {
      return { error: "Invalid email address", success: false };
    }

    const [teamResult, existingUserResult] = await Promise.allSettled([
      getTeamRecord(teamId),
      db.query.user.findFirst({ where: eq(userTable.email, trimmedEmail) }),
    ]);

    const team = teamResult.status === "fulfilled" ? teamResult.value : null;
    if (!team) {
      return { error: "Team not found", success: false };
    }

    const member = team.members.find((m) => m.id === memberId);
    if (!member) {
      return { error: "Member not found", success: false };
    }

    if (member.userId) {
      return { error: "This member slot is already claimed", success: false };
    }

    const existingUser =
      existingUserResult.status === "fulfilled" ? existingUserResult.value : null;

    if (existingUser) {
      const existingMembership = await db.query.membership.findFirst({
        where: and(eq(membershipTable.teamId, teamId), eq(membershipTable.userId, existingUser.id)),
      });

      if (existingMembership) {
        return { error: "This user is already a member of the team", success: false };
      }
    }

    // Upsert resets a previously declined invitation back to PENDING so it re-sends.
    const [invitation] = await db
      .insert(invitationTable)
      .values({
        email: trimmedEmail,
        id: crypto.randomUUID(),
        invitedById: session.user.id,
        memberId,
        teamId,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        set: {
          invitedById: session.user.id,
          memberId,
          status: "PENDING",
        },
        target: [invitationTable.email, invitationTable.teamId],
      })
      .returning();

    // Best-effort: a failed send is logged but doesn't fail the invitation.
    let emailSent = false;
    const apiKey = getEnv("RESEND_API_KEY");
    const fromEmail = getEnv("RESEND_FROM_EMAIL");
    const webAppUrl = getEnv("WEB_APP_URL") ?? "";

    if (apiKey) {
      const result = await sendInvitationEmail(
        {
          inviterName: session.user.name || session.user.email.split("@")[0] || "Someone",
          recipientEmail: trimmedEmail,
          teamId,
          teamName: team.name,
          teamUrl: webAppUrl,
        },
        { apiKey, ...(fromEmail && { from: fromEmail }) },
      );
      emailSent = result.success;
      if (!result.success) {
        log.error({
          error: result.error,
          message: "Failed to send invitation email",
          route: "actions/invitation",
        });
      }
    } else {
      after(() => {
        log.warn({
          message: "Resend not configured, skipping invitation email",
          recipientEmail: trimmedEmail,
          route: "actions/invitation",
        });
      });
    }

    return { data: { emailSent, invitationId: invitation.id }, success: true };
  } catch (error) {
    log.error({ error, message: "Failed to invite member", route: "actions/invitation" });
    return { error: "Failed to send invitation", success: false };
  }
};

const acceptInvitation = async (
  invitationId: string,
): Promise<ActionResult<{ teamId: string }>> => {
  try {
    const session = await requireAuth();

    const invitation = await db.query.invitation.findFirst({
      where: eq(invitationTable.id, invitationId),
    });

    if (!invitation) {
      return { error: "Invitation not found", success: false };
    }

    if (invitation.email !== session.user.email) {
      return { error: "This invitation is not for you", success: false };
    }

    if (invitation.status !== "PENDING") {
      return { error: "This invitation is no longer pending", success: false };
    }

    const existingMembership = await db.query.membership.findFirst({
      where: and(
        eq(membershipTable.teamId, invitation.teamId),
        eq(membershipTable.userId, session.user.id),
      ),
    });

    if (existingMembership) {
      // Already a member — just mark invitation as accepted
      await db
        .update(invitationTable)
        .set({ status: "ACCEPTED" })
        .where(eq(invitationTable.id, invitationId));
      return { data: { teamId: invitation.teamId }, success: true };
    }

    // Create membership + update invitation atomically
    await db.transaction(async (tx) => {
      await tx
        .update(invitationTable)
        .set({ status: "ACCEPTED" })
        .where(eq(invitationTable.id, invitationId));
      await tx.insert(membershipTable).values({
        id: crypto.randomUUID(),
        role: "MEMBER",
        teamId: invitation.teamId,
        updatedAt: new Date().toISOString(),
        userId: session.user.id,
      });
    });

    // Claim the member slot in Redis (best-effort)
    try {
      const team = await getTeamRecord(invitation.teamId);
      if (team) {
        const memberIndex = team.members.findIndex((m) => m.id === invitation.memberId);
        if (memberIndex !== -1 && !team.members[memberIndex].userId) {
          team.members[memberIndex].userId = session.user.id;
          await redis.set(
            `team:${invitation.teamId}`,
            JSON.stringify(team),
            "EX",
            TEAM_ACTIVE_TTL_SECONDS,
          );
        }
      }
    } catch (cacheError) {
      log.error({
        error: cacheError,
        message: "Failed to claim member slot in Redis",
        route: "actions/invitation",
      });
    }

    return { data: { teamId: invitation.teamId }, success: true };
  } catch (error) {
    log.error({ error, message: "Failed to accept invitation", route: "actions/invitation" });
    return { error: "Failed to accept invitation", success: false };
  }
};

const declineInvitation = async (invitationId: string): Promise<ActionResult<void>> => {
  try {
    const session = await requireAuth();

    const invitation = await db.query.invitation.findFirst({
      where: eq(invitationTable.id, invitationId),
    });

    if (!invitation) {
      return { error: "Invitation not found", success: false };
    }

    if (invitation.email !== session.user.email) {
      return { error: "This invitation is not for you", success: false };
    }

    if (invitation.status !== "PENDING") {
      return { error: "This invitation is no longer pending", success: false };
    }

    await db
      .update(invitationTable)
      .set({ status: "DECLINED" })
      .where(eq(invitationTable.id, invitationId));

    return { data: undefined, success: true };
  } catch (error) {
    log.error({ error, message: "Failed to decline invitation", route: "actions/invitation" });
    return { error: "Failed to decline invitation", success: false };
  }
};

export { acceptInvitation, declineInvitation, inviteMember };
