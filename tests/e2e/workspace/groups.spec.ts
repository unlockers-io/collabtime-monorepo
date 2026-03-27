import { test, expect } from "../fixtures";

test.describe("Group Management", () => {
  test.beforeEach(async ({ homePage, page }) => {
    await homePage.goto();
    await homePage.createWorkspace();
    await expect(page).toHaveURL(/\/[a-f0-9-]+/, { timeout: 10_000 });
    // Hard reload to ensure server component re-renders with fresh session
    await page.reload();
    await expect(page.getByRole("button", { name: /add group/i })).toBeVisible({ timeout: 30_000 });
  });

  test("creates a group", async ({ page }) => {
    await page.getByRole("button", { name: /add group/i }).click();

    await page.getByLabel("Group Name").click();
    await page.getByLabel("Group Name").pressSequentially("Engineering", { delay: 10 });
    await page.keyboard.press("Tab");

    await page.getByRole("button", { name: /create group/i }).click();

    // Group should appear in the groups section
    await expect(page.getByText("Engineering")).toBeVisible({ timeout: 5000 });
  });

  test("deletes a group", async ({ page }) => {
    // Create a group first
    await page.getByRole("button", { name: /add group/i }).click();
    await page.getByLabel("Group Name").click();
    await page.getByLabel("Group Name").pressSequentially("Marketing", { delay: 10 });
    await page.keyboard.press("Tab");
    await page.getByRole("button", { name: /create group/i }).click();
    await expect(page.getByText("Marketing")).toBeVisible({ timeout: 5000 });

    // Find the group card and click delete
    const groupCard = page.locator("[class*='rounded']").filter({
      hasText: "Marketing",
    });
    await groupCard.getByRole("button", { name: /remove|delete/i }).click();

    // Confirm if needed
    const confirmButton = page.getByRole("button", { name: /confirm|remove|delete/i });
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // Group should disappear
    await expect(page.getByText("Marketing")).not.toBeVisible({ timeout: 5000 });
  });
});
