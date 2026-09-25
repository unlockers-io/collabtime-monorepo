import { randomUUID } from "node:crypto";

import { prisma } from "@repo/db";
import { hashPassword } from "better-auth/crypto";

import { expect, test } from "../fixtures/realtime.fixture";
import { makeTestEmail } from "../helpers/test-email";

const PASSWORD = "InvitationTestPassword123!";

for (const isPrivate of [false, true]) {
  test(`manages and accepts an invitation in a ${isPrivate ? "private" : "public"} workspace`, async ({
    browser,
    createdTeamIds,
    homePage,
    page,
  }, testInfo) => {
    const email = makeTestEmail(testInfo);
    const userId = randomUUID();
    const password = await hashPassword(PASSWORD);
    await prisma.user.create({
      data: {
        accounts: {
          create: {
            accountId: userId,
            issuer: "local:credential",
            password,
            providerId: "credential",
          },
        },
        email,
        emailVerified: true,
        id: userId,
        name: "Invited Friend",
      },
    });
    const invitee = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      await homePage.goto();
      await homePage.createWorkspace("E2E Invitation Lifecycle");
      await expect(page).toHaveURL(/\/[a-f0-9-]{36}$/);
      const teamId = new URL(page.url()).pathname.slice(1);
      createdTeamIds.push(teamId);
      await page.getByRole("button", { name: /add team member/i }).click();
      await page.getByLabel("Full name").fill("Invited Friend");
      await page.getByLabel("Email (optional)").fill(email);
      await page.getByRole("button", { exact: true, name: "Add member" }).click();
      await expect(page.getByText("Invited", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: /Pending invitations/ }).click();
      await expect(
        page.getByRole("button", { name: `Resend invitation to ${email}` }),
      ).toBeVisible();

      await page.getByRole("button", { name: `Revoke invitation to ${email}` }).click();
      await expect(page.getByText("Invited", { exact: true })).toHaveCount(0);
      await page.getByRole("button", { exact: true, name: "Edit Invited Friend" }).click();
      await page.getByLabel("Invite by email").fill(email);
      await page.getByRole("button", { name: "Send invitation" }).click();
      await expect(page.getByText(`Invited ${email}`, { exact: true })).toBeVisible();
      await page.getByRole("button", { exact: true, name: "Cancel" }).click();
      const invitation = await prisma.invitation.findUniqueOrThrow({
        where: { email_teamId: { email, teamId } },
      });
      expect(invitation.status).toBe("PENDING");
      await prisma.invitation.update({
        data: { expiresAt: new Date(0) },
        where: { id: invitation.id },
      });
      await page.reload();
      await page.getByRole("button", { name: /Pending invitations/ }).click();
      await expect(page.getByText(/Invited Friend · Expired/)).toBeVisible();
      await expect(page.getByText("Invited", { exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: `Resend invitation to ${email}` }).click();
      await expect(page.getByText(/Invited Friend · Expires in 14 days/)).toBeVisible();

      if (isPrivate) {
        const space = await prisma.space.findUniqueOrThrow({ where: { teamId } });
        const response = await page.request.patch(`/api/spaces/${space.id}`, {
          data: { password: "PrivateInvitation123!", visibility: "private" },
        });
        expect(response.ok()).toBe(true);
      }
      const login = await invitee.request.post("/api/auth/sign-in/email", {
        data: { email, password: PASSWORD },
      });
      expect(login.status()).toBe(200);
      const friend = await invitee.newPage();
      await friend.goto(`/${teamId}?invite=${invitation.id}`);
      await expect(friend.getByRole("button", { name: "Accept invitation" })).toBeVisible();
      await friend.getByRole("button", { name: "Accept invitation" }).click();
      await expect(friend.getByText("You are a member of this team")).toBeVisible();
      const membership = await prisma.membership.findUniqueOrThrow({
        where: { userId_teamId: { teamId, userId } },
      });
      expect(membership.role).toBe("MEMBER");
      const accepted = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
      expect(accepted.status).toBe("ACCEPTED");
      await page.reload();
      await expect(page.getByText("Invited", { exact: true })).toHaveCount(0);
      await page
        .getByRole("button", { exact: true, name: "More actions for Invited Friend" })
        .click();
      await page.getByRole("menuitem", { name: "Remove from workspace" }).click();
      await page.getByRole("button", { exact: true, name: "Remove member" }).click();
      await expect.poll(() => prisma.membership.count({ where: { teamId, userId } })).toBe(0);
      await friend.reload();
      await expect(friend.getByRole("button", { name: "Add your profile" })).toHaveCount(0);
    } finally {
      await invitee.close();
      await prisma.user.delete({ where: { id: userId } });
    }
  });
}
