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
  await page.goto("/signup");
  await page.waitForLoadState("networkidle");

  await fillField(page, page.getByLabel("Name"), TEST_USER.name);
  await fillField(page, page.getByLabel("Email"), TEST_USER.email);
  await fillField(page, page.getByLabel("Password"), TEST_USER.password);

  const submitButton = page.getByRole("button", { name: /create account/i });
  await expect(submitButton).toBeEnabled({ timeout: 10_000 });
  await submitButton.click();

  // Signup succeeds (redirect) or fails (user already exists, stay on /signup)
  const signupSucceeded = await page
    .waitForURL((url) => !url.pathname.includes("/signup"), { timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  if (!signupSucceeded) {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await fillField(page, page.getByLabel("Email"), TEST_USER.email);
    await fillField(page, page.getByLabel("Password"), TEST_USER.password);

    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });
  }

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Verify authenticated state
  await expect(page.getByRole("button", { name: /create team workspace/i })).toBeVisible({
    timeout: 15_000,
  });

  await page.context().storageState({ path: STORAGE_STATE_PATH });
});

export { TEST_USER };
