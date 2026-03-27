import { test, expect } from "../fixtures/auth.fixture";

// Use a fresh storageState so registration tests run unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Register", () => {
  test("registers a new user and redirects to home", async ({ page, signupPage }) => {
    const uniqueEmail = `e2e-register-${Date.now()}@collabtime.localhost`;

    await signupPage.goto();
    await signupPage.signup("Test Register User", uniqueEmail, "TestPassword123!");

    await expect(page).toHaveURL("/", { timeout: 10_000 });
    await expect(page.getByRole("button", { name: /create team workspace/i })).toBeVisible();
  });

  test("shows error for duplicate email", async ({ page, signupPage, testUser }) => {
    await signupPage.goto();
    await signupPage.signup(testUser.name, testUser.email, testUser.password);

    await expect(page.getByText(/already exists|failed to create/i)).toBeVisible({ timeout: 5000 });
  });

  test("shows validation error for empty name", async ({ page, signupPage }) => {
    await signupPage.goto();

    const nameInput = page.getByLabel("Name");
    await nameInput.focus();
    await page.keyboard.press("Tab");

    await expect(page.getByText(/name is required/i)).toBeVisible();
  });

  test("shows validation error for invalid email", async ({ page, signupPage }) => {
    await signupPage.goto();

    const emailInput = page.getByLabel("Email");
    await emailInput.click();
    await emailInput.pressSequentially("bad-email", { delay: 10 });
    await page.keyboard.press("Tab");

    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test("shows validation error for short password", async ({ page, signupPage }) => {
    await signupPage.goto();

    const passwordInput = page.getByLabel("Password");
    await passwordInput.click();
    await passwordInput.pressSequentially("short", { delay: 10 });
    await page.keyboard.press("Tab");

    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test("navigates to login page", async ({ page, signupPage }) => {
    await signupPage.goto();
    await signupPage.getSignInLink().click();

    await expect(page).toHaveURL("/login");
  });
});
