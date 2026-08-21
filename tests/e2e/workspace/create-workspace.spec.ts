import { instant } from "@next/playwright";

import { test, expect } from "../fixtures/auth.fixture";

test.describe("Create Workspace", () => {
  test("creates a new workspace and navigates to it", async ({ homePage, page }) => {
    await homePage.goto();

    await expect(homePage.getCreateWorkspaceButton()).toBeVisible();
    await homePage.createWorkspace();

    await expect(page).toHaveURL(/\/[a-f0-9-]+/, { timeout: 10_000 });

    await expect(page.getByRole("heading", { name: /team members/i })).toBeVisible();
  });

  test("new workspace appears in My Teams list", async ({ homePage, page }) => {
    await homePage.goto();
    await homePage.createWorkspace();

    await expect(page).toHaveURL(/\/[a-f0-9-]+/, { timeout: 10_000 });

    await page.goto("/");

    await expect(homePage.getMyTeamsHeading()).toBeVisible({ timeout: 10_000 });
  });

  test("serves the workspace shell instantly when opened from My Teams", async ({
    homePage,
    page,
  }) => {
    await homePage.goto();
    await homePage.createWorkspace();

    await expect(page).toHaveURL(/\/[a-f0-9-]+/, { timeout: 10_000 });
    const teamId = new URL(page.url()).pathname.slice(1);

    await page.goto("/");
    await expect(homePage.getMyTeamsHeading()).toBeVisible({ timeout: 10_000 });

    const teamMembersHeading = page.getByRole("heading", { name: /team members/i });

    await instant(page, async () => {
      await homePage.getTeamLink(teamId).click();
      await page.waitForURL(`/${teamId}`);
      await expect(teamMembersHeading).toBeHidden();
    });

    await expect(teamMembersHeading).toBeVisible({ timeout: 10_000 });
  });
});
