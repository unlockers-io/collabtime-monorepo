"use server";

// oxlint-disable no-console -- server action diagnostic logging; TODO migrate to structured logger
import { prisma } from "@repo/db";

import { sendInvitationEmail } from "@/lib/email";
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

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
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

    // Upsert invitation (re-sends if previously declined)
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

    // Send email (best-effort)
    let emailSent = false;
    const webAppUrl = process.env.WEB_APP_URL || process.env.BETTER_AUTH_URL || "";
    try {
      emailSent = await sendInvitationEmail({
        inviterName: session.user.name || session.user.email.split("@")[0] || "Someone",
        teamName: team.name,
        teamUrl: webAppUrl,
        to: trimmedEmail,
      });
    } catch (emailError) {
      console.error("[Invitation] Failed to send email:", emailError);
    }

    return { data: { emailSent, invitationId: invitation.id }, success: true };
  } catch (error) {
    console.error("Failed to invite member:", error);
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

    // Check for existing membership
    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_teamId: {
          teamId: invitation.teamId,
          userId: session.user.id,
        },
      },
    });

    if (existingMembership) {
      // Already a member — just mark invitation as accepted
      await prisma.invitation.update({
        data: { status: "ACCEPTED" },
        where: { id: invitationId },
      });
      return { data: { teamId: invitation.teamId }, success: true };
    }

    // Create membership + update invitation atomically
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

    // Claim the member slot in Redis (best-effort)
    try {
      const team = await getTeamRecord(invitation.teamId);
      if (team) {
        const memberIndex = team.members.findIndex((m) => m.id === invitation.memberId);
        if (memberIndex !== -1 && !team.members[memberIndex].userId) {
          team.members[memberIndex].userId = session.user.id;
          await redis.set(`team:${invitation.teamId}`, JSON.stringify(team), {
            ex: TEAM_ACTIVE_TTL_SECONDS,
          });
        }
      }
    } catch (cacheError) {
      console.error("Failed to claim member slot in Redis:", cacheError);
    }

    return { data: { teamId: invitation.teamId }, success: true };
  } catch (error) {
    console.error("Failed to accept invitation:", error);
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
    console.error("Failed to decline invitation:", error);
    return { error: "Failed to decline invitation", success: false };
  }
};

export { acceptInvitation, declineInvitation, inviteMember };
