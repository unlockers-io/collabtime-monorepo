import { test, expect } from "../fixtures/auth.fixture";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Register", () => {
  test("shows validation error for empty name", async ({ page, registerPage }) => {
    await registerPage.goto();

    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByText(/name is required/i)).toBeVisible();
  });

  test("shows validation error for invalid email", async ({ page, registerPage }) => {
    await registerPage.goto();

    const nameInput = page.getByLabel("Name");
    await nameInput.click();
    await nameInput.pressSequentially("Test User", { delay: 10 });

    const emailInput = page.getByLabel("Email");
    await emailInput.click();
    await emailInput.pressSequentially("bad-email", { delay: 10 });
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test("shows validation error for short password", async ({ page, registerPage }) => {
    await registerPage.goto();

    const nameInput = page.getByLabel("Name");
    await nameInput.click();
    await nameInput.pressSequentially("Test User", { delay: 10 });

    const emailInput = page.getByLabel("Email");
    await emailInput.click();
    await emailInput.pressSequentially("test@example.com", { delay: 10 });

    const passwordInput = page.getByLabel("Password");
    await passwordInput.click();
    await passwordInput.pressSequentially("short", { delay: 10 });
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByText("Password must be at least 12 characters")).toBeVisible();
    await expect(passwordInput).toBeFocused();
  });

  test("navigates to login page", async ({ page, registerPage }) => {
    await registerPage.goto();
    await registerPage.getSignInLink().click();

    await expect(page).toHaveURL("/login");
  });
});
