import { test, expect } from "../fixtures/auth.fixture";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Logout", () => {
  test("signs out from the team page and redirects to home", async ({
    homePage,
    loginPage,
    page,
    testUser,
  }) => {
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
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

    await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();
  });
});
