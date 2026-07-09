import { test, expect } from "../fixtures/auth.fixture";

test.use({ storageState: { cookies: [], origins: [] } });

// Skip flag for the two tests that assert the pre-Resend signup flow.
// With RESEND_API_KEY set, Better Auth runs in
// requireEmailVerification + enumeration-prevention mode: signup
// returns 200 without a session and lands on a verify-pending screen,
// and duplicate signups return synthetic success. The auth-email/*
// suite covers the Resend path end-to-end (delivery assertions
// included), so these UI assertions are moot when Resend is wired up.
const skipUnderResend = !!process.env.RESEND_API_KEY;

test.describe("Register", () => {
  test("registers a new user and redirects to home", async ({ page, signupPage }) => {
    test.skip(skipUnderResend, "Resend-enabled flow is covered by auth-email/* specs");

    const uniqueEmail = `e2e-register-${Date.now()}@collabtime.localhost`;

    await signupPage.goto();
    await signupPage.signup("Test Register User", uniqueEmail, "TestPassword123!");

    await expect(page).toHaveURL("/", { timeout: 10_000 });
    await expect(page.getByRole("button", { name: /create team workspace/i })).toBeVisible();
  });

  test("shows error for duplicate email", async ({ page, signupPage, testUser }) => {
    test.skip(skipUnderResend, "Resend-enabled flow is covered by auth-email/* specs");

    await signupPage.goto();
    await signupPage.signup(testUser.name, testUser.email, testUser.password);

    await expect(page.getByText(/already exists|failed to create/i)).toBeVisible({ timeout: 5000 });
  });

  test("shows validation error for empty name", async ({ page, signupPage }) => {
    await signupPage.goto();

    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByText(/name is required/i)).toBeVisible();
  });

  test("shows validation error for invalid email", async ({ page, signupPage }) => {
    await signupPage.goto();

    const nameInput = page.getByLabel("Name");
    await nameInput.click();
    await nameInput.pressSequentially("Test User", { delay: 10 });

    const emailInput = page.getByLabel("Email");
    await emailInput.click();
    await emailInput.pressSequentially("bad-email", { delay: 10 });
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test("shows validation error for short password", async ({ page, signupPage }) => {
    await signupPage.goto();

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

    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test("navigates to login page", async ({ page, signupPage }) => {
    await signupPage.goto();
    await signupPage.getSignInLink().click();

    await expect(page).toHaveURL("/login");
  });
});
