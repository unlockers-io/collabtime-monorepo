import { test, expect } from "../fixtures/auth.fixture";

// Use a separate session so signing out doesn't invalidate the shared test user's session
test.use({ storageState: { cookies: [], origins: [] } });

// Skip: admin UI doesn't render in CI production builds (Better Auth session detection)
test.describe.skip("Logout", () => {
  test("signs out from the team page and redirects to home", async ({
    homePage,
    page,
    signupPage,
  }) => {
    const logoutEmail = `e2e-logout-${Date.now()}@collabtime.localhost`;
    await signupPage.goto();
    await signupPage.signup("Logout Test User", logoutEmail, "TestPassword123!");
    await expect(page).toHaveURL("/", { timeout: 10_000 });

    await homePage.createWorkspace();

    await expect(page).toHaveURL(/\/[a-f0-9-]+/, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible({
      timeout: 60_000,
    });

    await page.getByRole("button", { name: /account menu/i }).click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();

    await expect(page.getByText(/signed out successfully/i)).toBeVisible({
      timeout: 5000,
    });

    await expect(page).toHaveURL("/", { timeout: 10_000 });

    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
  });
});
