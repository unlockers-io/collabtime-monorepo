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
});
