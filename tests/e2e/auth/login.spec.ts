import { test, expect } from "../fixtures/auth.fixture";

test.describe("Login", () => {
  test("logs in with valid credentials and redirects to home", async ({
    loginPage,
    page,
    testUser,
  }) => {
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);

    await expect(page).toHaveURL("/", { timeout: 10_000 });
    await expect(page.getByRole("button", { name: /create team workspace/i })).toBeVisible();
  });

  test("shows error with wrong password", async ({ loginPage, page, testUser }) => {
    await loginPage.goto();
    await loginPage.login(testUser.email, "WrongPassword999!");

    // Sonner toast with error message
    await expect(page.getByText(/failed to sign in|invalid/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("shows validation error for invalid email", async ({ loginPage, page }) => {
    await loginPage.goto();

    const emailInput = page.getByLabel("Email");
    await emailInput.click();
    await emailInput.pressSequentially("not-an-email", { delay: 10 });
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test("shows validation error for empty password", async ({ loginPage, page }) => {
    await loginPage.goto();

    const emailInput = page.getByLabel("Email");
    await emailInput.click();
    await emailInput.pressSequentially("test@example.com", { delay: 10 });
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test("navigates to signup page", async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.getSignUpLink().click();

    await expect(page).toHaveURL("/signup");
  });
});
