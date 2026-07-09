"use server";

import { prisma } from "@repo/db";
import { sendInvitationEmail } from "@repo/transactional";
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
      prisma.user.findUnique({ where: { email: trimmedEmail } }),
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

    // Upsert resets a previously declined invitation back to PENDING so it re-sends.
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
