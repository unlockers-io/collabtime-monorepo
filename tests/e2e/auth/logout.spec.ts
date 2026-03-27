import { test, expect } from "../fixtures";

test.describe("Logout", () => {
  test("signs out from the team page and redirects to home", async ({ homePage, page }) => {
    // Create a workspace so we can access the team page with the UserMenu
    await homePage.goto();
    await homePage.createWorkspace();

    // Wait for navigation to team page and data to load
    await expect(page).toHaveURL(/\/[a-f0-9-]+/, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible({
      timeout: 30_000,
    });

    // Open the account menu dropdown
    await page.getByRole("button", { name: /account menu/i }).click();

    // Click "Sign out"
    await page.getByRole("menuitem", { name: /sign out/i }).click();

    // Should show success toast and redirect to home
    await expect(page.getByText(/signed out successfully/i)).toBeVisible({
      timeout: 5000,
    });

    await expect(page).toHaveURL("/", { timeout: 10_000 });

    // Should see unauthenticated state (Get Started link instead of Create Team Workspace)
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
  });
});
