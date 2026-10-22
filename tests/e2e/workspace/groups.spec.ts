import { test, expect } from "../fixtures/workspace.fixture";

test.describe("Group Management", () => {
  test.beforeEach(async ({ homePage, page }) => {
    await homePage.goto();
    await homePage.createWorkspace();
    await expect(page).toHaveURL(/\/[a-f0-9-]+/, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: /add group/i })).toBeVisible({ timeout: 60_000 });
  });

  test("creates a group", async ({ page }) => {
    await page.getByRole("button", { name: /add group/i }).click();

    await page.getByLabel("Group Name").click();
    await page.getByLabel("Group Name").pressSequentially("Engineering", { delay: 10 });
    await page.keyboard.press("Tab");

    await page.getByRole("button", { name: /create group/i }).click();

    await expect(page.getByText("Engineering", { exact: true })).toBeVisible({ timeout: 5000 });
  });

  // The legacy rounded-container selector matches multiple nested containers; tracked in docs/LAUNCH.md.
  test.skip("deletes a group", async ({ page }) => {
    await page.getByRole("button", { name: /add group/i }).click();
    await page.getByLabel("Group Name").click();
    await page.getByLabel("Group Name").pressSequentially("Marketing", { delay: 10 });
    await page.keyboard.press("Tab");
    await page.getByRole("button", { name: /create group/i }).click();
    await expect(page.getByText("Marketing")).toBeVisible({ timeout: 5000 });

    const groupCard = page.locator("[class*='rounded']").filter({
      hasText: "Marketing",
    });

    await groupCard.getByRole("button", { name: /remove|delete/i }).click();

    const confirmButton = page.getByRole("button", { name: /confirm|remove|delete/i });

    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }

    await expect(page.getByText("Marketing")).not.toBeVisible({ timeout: 5000 });
  });
});
