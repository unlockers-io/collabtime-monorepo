"use server";

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
      return { success: false, error: "Invalid team ID" };
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return { success: false, error: "Invalid email address" };
    }

    const [teamResult, existingUserResult] = await Promise.allSettled([
      getTeamRecord(teamId),
      prisma.user.findUnique({ where: { email: trimmedEmail } }),
    ]);

    const team = teamResult.status === "fulfilled" ? teamResult.value : null;
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const member = team.members.find((m) => m.id === memberId);
    if (!member) {
      return { success: false, error: "Member not found" };
    }

    if (member.userId) {
      return { success: false, error: "This member slot is already claimed" };
    }

    const existingUser =
      existingUserResult.status === "fulfilled" ? existingUserResult.value : null;

    if (existingUser) {
      const existingMembership = await prisma.membership.findUnique({
        where: {
          userId_teamId: {
            userId: existingUser.id,
            teamId,
          },
        },
      });

      if (existingMembership) {
        return { success: false, error: "This user is already a member of the team" };
      }
    }

    // Upsert invitation (re-sends if previously declined)
    const invitation = await prisma.invitation.upsert({
      where: {
        email_teamId: {
          email: trimmedEmail,
          teamId,
        },
      },
      update: {
        memberId,
        status: "PENDING",
        invitedById: session.user.id,
      },
      create: {
        email: trimmedEmail,
        teamId,
        memberId,
        invitedById: session.user.id,
      },
    });

    // Send email (best-effort)
    let emailSent = false;
    const webAppUrl = process.env.WEB_APP_URL || process.env.BETTER_AUTH_URL || "";
    try {
      emailSent = await sendInvitationEmail({
        to: trimmedEmail,
        teamName: team.name,
        inviterName: session.user.name || session.user.email.split("@")[0] || "Someone",
        teamUrl: webAppUrl,
      });
    } catch (emailError) {
      console.error("[Invitation] Failed to send email:", emailError);
    }

    return { success: true, data: { invitationId: invitation.id, emailSent } };
  } catch (error) {
    console.error("Failed to invite member:", error);
    return { success: false, error: "Failed to send invitation" };
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
      return { success: false, error: "Invitation not found" };
    }

    if (invitation.email !== session.user.email) {
      return { success: false, error: "This invitation is not for you" };
    }

    if (invitation.status !== "PENDING") {
      return { success: false, error: "This invitation is no longer pending" };
    }

    // Check for existing membership
    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId: invitation.teamId,
        },
      },
    });

    if (existingMembership) {
      // Already a member — just mark invitation as accepted
      await prisma.invitation.update({
        where: { id: invitationId },
        data: { status: "ACCEPTED" },
      });
      return { success: true, data: { teamId: invitation.teamId } };
    }

    // Create membership + update invitation atomically
    await prisma.$transaction([
      prisma.invitation.update({
        where: { id: invitationId },
        data: { status: "ACCEPTED" },
      }),
      prisma.membership.create({
        data: {
          userId: session.user.id,
          teamId: invitation.teamId,
          role: "MEMBER",
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

    return { success: true, data: { teamId: invitation.teamId } };
  } catch (error) {
    console.error("Failed to accept invitation:", error);
    return { success: false, error: "Failed to accept invitation" };
  }
};

const declineInvitation = async (invitationId: string): Promise<ActionResult<void>> => {
  try {
    const session = await requireAuth();

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }

    if (invitation.email !== session.user.email) {
      return { success: false, error: "This invitation is not for you" };
    }

    if (invitation.status !== "PENDING") {
      return { success: false, error: "This invitation is no longer pending" };
    }

    await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: "DECLINED" },
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Failed to decline invitation:", error);
    return { success: false, error: "Failed to decline invitation" };
  }
};

export { acceptInvitation, declineInvitation, inviteMember };
