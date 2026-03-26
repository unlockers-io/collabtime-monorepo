import { expect, test as setup } from "@playwright/test";

const TEST_USER = {
  email: "e2e-test@collabtime.localhost",
  name: "E2E Test User",
  password: "TestPassword123!",
};

const STORAGE_STATE_PATH = "tests/e2e/.auth/user.json";

/**
 * Type into a field using pressSequentially + Tab to reliably trigger
 * TanStack Form's onChange and onBlur validators.
 */
const fillField = async (
  page: import("@playwright/test").Page,
  locator: import("@playwright/test").Locator,
  value: string,
) => {
  await locator.click();
  await locator.clear();
  await locator.pressSequentially(value, { delay: 10 });
  await page.keyboard.press("Tab");
};

setup("create and authenticate test user", async ({ page }) => {
  // Try signup first
  await page.goto("/signup");
  await page.waitForLoadState("networkidle");

  await fillField(page, page.getByLabel("Name"), TEST_USER.name);
  await fillField(page, page.getByLabel("Email"), TEST_USER.email);
  await fillField(page, page.getByLabel("Password"), TEST_USER.password);

  const submitButton = page.getByRole("button", { name: /create account/i });
  await expect(submitButton).toBeEnabled({ timeout: 10_000 });
  await submitButton.click();

  // Wait for redirect away from /signup (signup success) or error toast (user exists)
  const redirected = await page
    .waitForURL((url) => !url.pathname.includes("/signup"), { timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  if (!redirected) {
    // Signup failed (user already exists) — fall back to login
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await fillField(page, page.getByLabel("Email"), TEST_USER.email);
    await fillField(page, page.getByLabel("Password"), TEST_USER.password);

    const signInButton = page.getByRole("button", { name: /sign in/i });
    await expect(signInButton).toBeEnabled({ timeout: 10_000 });
    await signInButton.click();

    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });
  }

  // Navigate to home and wait for authenticated state
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Wait for the heading to confirm the page loaded
  await expect(page.getByRole("heading", { name: "Collab Time" })).toBeVisible({ timeout: 15_000 });

  // Wait for session to hydrate — either "Create Team Workspace" (authenticated) or "Get Started" (not)
  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return body.includes("Create Team Workspace") || body.includes("Get Started");
    },
    { timeout: 15_000 },
  );

  // Verify we're actually authenticated
  const isAuthenticated = await page
    .getByRole("button", { name: /create team workspace/i })
    .isVisible()
    .catch(() => false);

  if (!isAuthenticated) {
    throw new Error("Auth setup failed: user is not authenticated after signup/login");
  }

  await page.context().storageState({ path: STORAGE_STATE_PATH });
});

export { TEST_USER };
