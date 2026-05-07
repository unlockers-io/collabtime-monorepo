import { test, expect } from "../fixtures/auth.fixture";

// Skip: admin UI doesn't render in CI production builds (Better Auth session detection)
test.describe.skip("Member Management", () => {
  test.beforeEach(async ({ homePage, page }) => {
    await homePage.goto();
    await homePage.createWorkspace();
    await expect(page).toHaveURL(/\/[a-f0-9-]+/, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: /add team member/i })).toBeVisible({
      timeout: 60_000,
    });
  });

  test("adds a member to the workspace", async ({ page }) => {
    // Click "Add Team Member" button
    await page.getByRole("button", { name: /add team member/i }).click();

    // Fill in the add member dialog
    await page.getByLabel("Name *").click();
    await page.getByLabel("Name *").pressSequentially("Alice Johnson", { delay: 10 });
    await page.keyboard.press("Tab");

    // Submit the form
    await page.getByRole("button", { name: /add member/i }).click();

    // Wait for dialog to close and member to appear
    await expect(page.getByText("Alice Johnson")).toBeVisible({
      timeout: 5000,
    });
  });

  test("removes a member from the workspace", async ({ page }) => {
    // First add a member
    await page.getByRole("button", { name: /add team member/i }).click();
    await page.getByLabel("Name *").click();
    await page.getByLabel("Name *").pressSequentially("Bob Smith", { delay: 10 });
    await page.keyboard.press("Tab");
    await page.getByRole("button", { name: /add member/i }).click();
    await expect(page.getByText("Bob Smith")).toBeVisible({ timeout: 5000 });

    // Find and click the remove/delete button on the member card
    const memberCard = page.locator("[class*='rounded']").filter({
      hasText: "Bob Smith",
    });
    await memberCard.getByRole("button", { name: /remove|delete/i }).click();

    // Confirm removal if there's a confirmation dialog
    const confirmButton = page.getByRole("button", { name: /confirm|remove|delete/i });
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // Member should disappear
    await expect(page.getByText("Bob Smith")).not.toBeVisible({ timeout: 5000 });
  });
});
