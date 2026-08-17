"use server";

import { prisma } from "@repo/db";
import { sendTransactionalEmail } from "@repo/transactional";
import { after } from "next/server";

import { getEnv } from "@/lib/env";
import { log } from "@/lib/observability";
import { requireAuth, requireTeamAdmin } from "@/lib/team-auth";

import { applyTeamContents, readTeamRecord } from "../team-store";
import { UUIDSchema } from "../validation";

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

    // Promise.all, not allSettled: a rejected user lookup must not read as "no
    // such user", which would skip the already-a-member guard below and invite
    // someone who is already on the team.
    const [team, existingUser] = await Promise.all([
      readTeamRecord(teamId),
      prisma.user.findUnique({ where: { email: trimmedEmail } }),
    ]);

    if (!team) {
      return { error: "Team not found", success: false };
    }

    const member = team.members.find((m) => m.id === memberId);
    if (!member) {
      return { error: "Member not found", success: false };
    }

    if (member.userId !== undefined && member.userId !== "") {
      return { error: "This member slot is already claimed", success: false };
    }

    if (existingUser) {
      const existingMembership = await prisma.membership.findUnique({
        where: {
          userId_teamId: {
            teamId,
            userId: existingUser.id,
          },
        },
      });

      if (existingMembership) {
        return { error: "This user is already a member of the team", success: false };
      }
    }

    const invitation = await prisma.invitation.upsert({
      create: {
        email: trimmedEmail,
        invitedById: session.user.id,
        memberId,
        teamId,
      },
      update: {
        invitedById: session.user.id,
        memberId,
        status: "PENDING",
      },
      where: {
        email_teamId: {
          email: trimmedEmail,
          teamId,
        },
      },
    });

    let emailSent = false;
    const apiKey = getEnv("RESEND_API_KEY");
    const fromEmail = getEnv("RESEND_FROM_EMAIL");
    const webAppUrl = getEnv("WEB_APP_URL") ?? "";

    if (apiKey !== undefined && apiKey !== "") {
      const result = await sendTransactionalEmail(
        {
          inviterName: session.user.name || session.user.email.split("@")[0] || "Someone",
          recipientEmail: trimmedEmail,
          teamId,
          teamName: team.name,
          teamUrl: webAppUrl,
          type: "invitation",
        },
        { apiKey, ...(fromEmail !== undefined && fromEmail !== "" ? { from: fromEmail } : {}) },
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

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
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

    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_teamId: {
          teamId: invitation.teamId,
          userId: session.user.id,
        },
      },
    });

    if (existingMembership) {
      await prisma.invitation.update({
        data: { status: "ACCEPTED" },
        where: { id: invitationId },
      });
      return { data: { teamId: invitation.teamId }, success: true };
    }

    await prisma.$transaction([
      prisma.invitation.update({
        data: { status: "ACCEPTED" },
        where: { id: invitationId },
      }),
      prisma.membership.create({
        data: {
          role: "MEMBER",
          teamId: invitation.teamId,
          userId: session.user.id,
        },
      }),
    ]);

    const applied = await applyTeamContents(invitation.teamId, (team) => {
      if (team === null) {
        return { error: "Team not found", ok: false };
      }

      const memberIndex = team.members.findIndex((m) => m.id === invitation.memberId);
      const slotUserId = memberIndex === -1 ? undefined : team.members[memberIndex].userId;
      if (memberIndex === -1 || (slotUserId !== undefined && slotUserId !== "")) {
        return { ok: true, team: null, value: undefined };
      }

      team.members[memberIndex].userId = session.user.id;

      return { ok: true, team, value: undefined };
    });

    if (!applied.ok) {
      log.error({
        invitationId,
        message: "Membership committed but the member slot was not claimed",
        reason: applied.reason,
        route: "actions/invitation",
      });
      return { error: "You joined the team, but claiming your profile failed", success: false };
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

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
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

    await prisma.invitation.update({
      data: { status: "DECLINED" },
      where: { id: invitationId },
    });

    return { data: undefined, success: true };
  } catch (error) {
    log.error({ error, message: "Failed to decline invitation", route: "actions/invitation" });
    return { error: "Failed to decline invitation", success: false };
  }
};

export { acceptInvitation, declineInvitation, inviteMember };
