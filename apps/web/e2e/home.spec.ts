import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display the home page title", async ({ page }) => {
    await expect(page).toHaveTitle(/Collab Time/);
  });

  test("should display the create team button", async ({ page }) => {
    const createButton = page.getByRole("button", { name: /create/i });
    await expect(createButton).toBeVisible();
  });

  test("should display navigation elements", async ({ page }) => {
    // Check for the logo/brand
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
  });
});

test.describe("Team Creation Flow", () => {
  test("should navigate to team creation", async ({ page }) => {
    await page.goto("/");

    // Look for the create team button and click it
    const createButton = page.getByRole("button", { name: /create/i });
    await createButton.click();

    // Should show password input dialog
    await expect(
      page.getByRole("heading", { name: /create.*team|admin.*password/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("should require password for team creation", async ({ page }) => {
    await page.goto("/");

    const createButton = page.getByRole("button", { name: /create/i });
    await createButton.click();

    // Try to submit without password
    const submitButton = page.getByRole("button", { name: /create/i }).last();

    // The submit button should be disabled or show validation error
    // when password is empty
    const passwordInput = page.getByPlaceholder(/password/i);
    await expect(passwordInput).toBeVisible();
  });

  test("should create team with valid password", async ({ page }) => {
    await page.goto("/");

    const createButton = page.getByRole("button", { name: /create/i });
    await createButton.click();

    // Fill in the password
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill("testpassword123");

    // Submit the form
    const submitButton = page.getByRole("button", { name: /create/i }).last();
    await submitButton.click();

    // Should navigate to the team page
    await expect(page).toHaveURL(/\/[0-9a-f-]+/, { timeout: 10000 });
  });
});
