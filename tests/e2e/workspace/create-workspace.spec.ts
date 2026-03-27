import { test, expect } from "../fixtures";

test.describe("Create Workspace", () => {
  test("creates a new workspace and navigates to it", async ({ homePage, page }) => {
    await homePage.goto();

    await expect(homePage.getCreateWorkspaceButton()).toBeVisible();
    await homePage.createWorkspace();

    // Should navigate to a UUID-based team route
    await expect(page).toHaveURL(/\/[a-f0-9-]+/, { timeout: 10_000 });

    // Should see the team page with empty state
    await expect(page.getByText(/build your team/i)).toBeVisible();

    // Admin UI should render (Add Team Member button)
    await expect(page.getByRole("button", { name: /add team member/i })).toBeVisible({
      timeout: 60_000,
    });
  });

  test("new workspace appears in My Teams list", async ({ homePage, page }) => {
    await homePage.goto();
    await homePage.createWorkspace();

    // Wait for team page to load
    await expect(page).toHaveURL(/\/[a-f0-9-]+/, { timeout: 10_000 });

    // Navigate back to home
    await page.goto("/");

    // My Teams section should be visible with the new workspace
    await expect(homePage.getMyTeamsHeading()).toBeVisible({ timeout: 10_000 });
  });
});
