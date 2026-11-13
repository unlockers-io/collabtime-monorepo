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

  test("deletes a group", async ({ page }) => {
    await page.getByRole("button", { name: /add group/i }).click();
    await page.getByLabel("Group Name").click();
    await page.getByLabel("Group Name").pressSequentially("Marketing", { delay: 10 });
    await page.keyboard.press("Tab");
    await page.getByRole("button", { name: /create group/i }).click();

    const marketing = page.getByText("Marketing", { exact: true });
    await expect(marketing).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Remove group Marketing" }).click();
    await page.getByRole("button", { exact: true, name: "Remove group" }).click();

    await expect(marketing).toBeHidden({ timeout: 5000 });
  });
});
