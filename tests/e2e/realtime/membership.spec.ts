import { randomUUID } from "node:crypto";

import type { Browser, BrowserContext, Page } from "@playwright/test";
import { prisma } from "@repo/db";
import { hashPassword } from "better-auth/crypto";

import { expect, test } from "../fixtures/workspace.fixture";
import { webUrl } from "../urls";

const PASSWORD = "MembershipTestPassword123!";

const createPeer = async (browser: Browser) => {
  const id = randomUUID();
  const email = `e2e-membership-${id}@collabtime.localhost`;
  await prisma.user.create({
    data: {
      accounts: {
        create: {
          accountId: id,
          issuer: "local:credential",
          password: await hashPassword(PASSWORD),
          providerId: "credential",
        },
      },
      email,
      emailVerified: true,
      id,
      name: "Live Peer",
    },
  });

  const context = await browser.newContext({
    baseURL: webUrl,
    storageState: { cookies: [], origins: [] },
  });

  const response = await context.request.post("/api/auth/sign-in/email", {
    data: { email, password: PASSWORD },
  });

  expect(response.status()).toBe(200);
  const page = await context.newPage();

  return { context, email, id, page };
};

const openLive = async (page: Page, teamId: string) => {
  const connected = page.waitForResponse(
    (response) => new URL(response.url()).pathname === `/api/teams/${teamId}/events`,
  );

  await page.goto(`/${teamId}`);
  const response = await connected;
  expect(response.status()).toBe(200);
};

const removePeer = async (page: Page) => {
  await page.getByRole("button", { exact: true, name: "More actions for Live Peer" }).click();
  await page.getByRole("menuitem", { name: "Remove from workspace" }).click();
  await page.getByRole("button", { exact: true, name: "Remove member" }).click();
};

const cleanPeer = async (context: BrowserContext, userId: string) => {
  await context.close();
  await prisma.user.delete({ where: { id: userId } });
};

for (const passwordAccess of [false, true]) {
  test(`membership revocation preserves private password access=${passwordAccess}`, async ({
    browser,
    homePage,
    page,
    request,
  }) => {
    await homePage.goto();
    await homePage.createWorkspace();
    await expect(page).toHaveURL(/\/[a-f0-9-]{36}$/);
    const teamId = new URL(page.url()).pathname.slice(1);
    const space = await prisma.space.findUniqueOrThrow({ where: { teamId } });
    const peer = await createPeer(browser);

    try {
      const memberId = randomUUID();
      await prisma.teamMember.create({
        data: {
          id: memberId,
          name: "Live Peer",
          order: 1,
          teamId,
          timezone: "Europe/Berlin",
          title: "Engineer",
          workingHoursEnd: 17,
          workingHoursStart: 9,
        },
      });

      const invitation = await prisma.invitation.create({
        data: { email: peer.email, invitedById: space.ownerId, memberId, teamId },
      });

      const updated = await request.patch(`/api/spaces/${space.id}`, {
        data: { password: "PrivateWorkspace123!", visibility: "private" },
      });

      expect(updated.status()).toBe(200);
      await peer.page.goto(`/${teamId}?invite=${invitation.id}`);
      await peer.page.getByRole("button", { name: "Accept invitation" }).click();
      await expect(
        peer.page.getByText("You are a member of this team.", { exact: true }),
      ).toBeVisible();

      if (passwordAccess) {
        const verified = await peer.context.request.post(
          `/api/spaces/${space.id}/verify-password`,
          { data: { password: "PrivateWorkspace123!" } },
        );

        expect(verified.status()).toBe(200);
      }

      const cookies = await peer.context.cookies();
      expect(cookies.some((cookie) => cookie.name.startsWith("space-access"))).toBe(passwordAccess);
      await openLive(peer.page, teamId);
      await page.reload();
      await removePeer(page);

      if (passwordAccess) {
        await expect(
          peer.page.getByRole("button", { exact: true, name: "Request to join" }),
        ).toBeVisible({ timeout: 5000 });
        await expect(
          peer.page.getByRole("heading", { exact: true, name: "Team members" }),
        ).toBeVisible();
        await expect(
          peer.page.getByRole("heading", { exact: true, name: "Private workspace" }),
        ).not.toBeVisible();
      } else {
        await expect(
          peer.page.getByRole("heading", { exact: true, name: "Private workspace" }),
        ).toBeVisible({ timeout: 5000 });
        await expect(
          peer.page.getByRole("heading", { exact: true, name: "Team members" }),
        ).not.toBeVisible();
      }
    } finally {
      await cleanPeer(peer.context, peer.id);
    }
  });
}

test("approved public requester gets member controls without reloading", async ({
  browser,
  homePage,
  page,
}) => {
  await homePage.goto();
  await homePage.createWorkspace();
  await expect(page).toHaveURL(/\/[a-f0-9-]{36}$/);
  const teamId = new URL(page.url()).pathname.slice(1);
  const peer = await createPeer(browser);

  try {
    await openLive(peer.page, teamId);
    let navigations = 0;
    peer.page.on("request", (request) => {
      if (request.isNavigationRequest()) {
        navigations += 1;
      }
    });
    await peer.page.getByRole("button", { exact: true, name: "Request to join" }).click();
    await expect(
      peer.page.getByText("Your join request is pending admin approval.", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: /Join requests/ }).click();
    await page.getByRole("button", { exact: true, name: "Approve Live Peer" }).click();
    await expect(
      peer.page.getByText("You are a member of this team.", { exact: true }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      peer.page.getByText("Your join request is pending admin approval.", { exact: true }),
    ).not.toBeVisible();
    expect(navigations).toBe(0);
  } finally {
    await cleanPeer(peer.context, peer.id);
  }
});
