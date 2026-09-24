import type { Page } from "@playwright/test";
import { prisma } from "@repo/db";

import { expect, test as base } from "../fixtures/realtime.fixture";

const members = (page: Page) =>
  page.locator("section").filter({
    has: page.getByRole("heading", { exact: true, name: "Team members" }),
  });

const openLiveTeam = async (page: Page, teamId: string) => {
  await page.addInitScript(() => {
    const NativeEventSource = window.EventSource;
    window.EventSource = class extends NativeEventSource {
      override close() {
        super.close();
        document.documentElement.dataset.liveSyncReady = "false";
      }
      constructor(url: string | URL, options?: EventSourceInit) {
        super(url, options);
        this.addEventListener("ready", () => {
          document.documentElement.dataset.liveSyncReady = "true";
        });
      }
    };
  });
  const responsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === `/api/teams/${teamId}/events`,
  );
  await page.goto(`/${teamId}`);
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/event-stream");
  await expect(page.locator("html")).toHaveAttribute("data-live-sync-ready", "true");
  await expect(page.getByRole("heading", { exact: true, name: "Team members" })).toBeVisible();
};

const addMember = async (page: Page, name: string) => {
  await page.getByRole("button", { name: /add team member/i }).click();
  await page.getByLabel("Full name").fill(name);
  await page.keyboard.press("Tab");
  await page.getByRole("button", { exact: true, name: "Add member" }).click();
  await expect(members(page).getByText(name, { exact: true })).toBeVisible({ timeout: 5000 });
};

const test = base.extend<{ peer: Page; teamId: string }>({
  peer: async ({ browser, storageState, teamId }, use) => {
    const context = await browser.newContext({ storageState });
    try {
      const page = await context.newPage();
      await openLiveTeam(page, teamId);
      await use(page);
    } finally {
      await context.close();
    }
  },
  teamId: async ({ createdTeamIds, homePage, page }, use) => {
    await homePage.goto();
    await homePage.createWorkspace();
    await expect(page).toHaveURL(/\/[a-f0-9-]+/, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: /add team member/i })).toBeVisible();
    const id = new URL(page.url()).pathname.slice(1);
    createdTeamIds.push(id);
    await use(id);
  },
});

const setVisibility = (page: Page, visibility: DocumentVisibilityState) =>
  page.evaluate((state) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
    document.dispatchEvent(new Event("visibilitychange"));
  }, visibility);

for (const change of ["privacy", "password", "deletion"] as const) {
  test(`recovers a ${change} change missed by a hidden guest`, async ({
    browser,
    request,
    teamId,
  }) => {
    const { id: spaceId } = await prisma.space.findUniqueOrThrow({
      select: { id: true },
      where: { teamId },
    });
    const guestContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      if (change === "password") {
        const privateSpace = await request.patch(`/api/spaces/${spaceId}`, {
          data: { password: "OriginalGuestPassword123!", visibility: "private" },
        });
        expect(privateSpace.status()).toBe(200);
        const verified = await guestContext.request.post(`/api/spaces/${spaceId}/verify-password`, {
          data: { password: "OriginalGuestPassword123!" },
        });
        expect(verified.status()).toBe(200);
      }
      const guest = await guestContext.newPage();
      await guest.clock.install();
      await openLiveTeam(guest, teamId);
      await setVisibility(guest, "hidden");
      await guest.clock.runFor(10_000);
      await expect(guest.locator("html")).toHaveAttribute("data-live-sync-ready", "false");

      const updated =
        change === "deletion"
          ? await request.delete(`/api/spaces/${spaceId}`)
          : await request.patch(`/api/spaces/${spaceId}`, {
              data: { password: "ChangedGuestPassword123!", visibility: "private" },
            });
      expect(updated.status()).toBe(200);
      const checked = guest.waitForResponse(
        (response) =>
          response.request().method() === "HEAD" &&
          new URL(response.url()).pathname === `/api/teams/${teamId}/events`,
      );
      await setVisibility(guest, "visible");
      const response = await checked;
      expect(response.status()).toBe(change === "deletion" ? 404 : 403);
      await expect(
        guest.getByRole("heading", {
          exact: true,
          name: change === "deletion" ? "Workspace not found" : "Private workspace",
        }),
      ).toBeVisible();
      await expect(
        guest.getByRole("heading", { exact: true, name: "Team members" }),
      ).not.toBeVisible();
    } finally {
      await guestContext.close();
    }
  });
}

test.describe("Realtime Sync", () => {
  test("member added syncs to second browser", async ({ page, peer }) => {
    await addMember(page, "Realtime Alice");
    await expect(members(peer).getByText("Realtime Alice", { exact: true })).toBeVisible({
      timeout: 5000,
    });
  });

  test("group created syncs to second browser", async ({ page, peer }) => {
    await page.getByRole("button", { name: /add group/i }).click();
    await page.getByLabel("Group Name").fill("Sync Test Group");
    await page.keyboard.press("Tab");
    await page.getByRole("button", { name: /create group/i }).click();
    await expect(peer.getByText("Sync Test Group", { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test("team name change syncs to second browser", async ({ page, peer }) => {
    await page.getByRole("button", { name: "Rename workspace" }).click();
    await page
      .getByRole("textbox", { exact: true, name: "Workspace name" })
      .fill("Synced Team Name");
    await page.keyboard.press("Tab");
    await expect(peer.getByRole("heading", { exact: true, name: "Synced Team Name" })).toBeVisible({
      timeout: 5000,
    });
  });

  test("member removed syncs to second browser", async ({ page, peer }) => {
    await addMember(page, "Removal Target");
    await expect(members(peer).getByText("Removal Target", { exact: true })).toBeVisible({
      timeout: 5000,
    });
    await page
      .getByRole("button", { exact: true, name: "More actions for Removal Target" })
      .click();
    await page.getByRole("menuitem", { name: "Remove from workspace" }).click();
    await page.getByRole("button", { exact: true, name: "Remove member" }).click();
    await expect(members(peer).getByText("Removal Target", { exact: true })).not.toBeVisible({
      timeout: 5000,
    });
  });
});
