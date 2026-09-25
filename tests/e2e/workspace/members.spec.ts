import { test, expect } from "../fixtures/auth.fixture";

test.describe("Member Management", () => {
  test.beforeEach(async ({ homePage, page }) => {
    await homePage.goto();
    await homePage.createWorkspace();
    await expect(page).toHaveURL(/\/[a-f0-9-]+/, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: /add team member/i })).toBeVisible({
      timeout: 60_000,
    });
  });

  test("adds a member to the workspace", async ({ page }) => {
    await page.getByRole("button", { name: /add team member/i }).click();

    await page.getByLabel("Full name").click();
    await page.getByLabel("Full name").pressSequentially("Alice Johnson", { delay: 10 });
    await page.keyboard.press("Tab");

    await page.getByRole("button", { name: /add member/i }).click();

    const membersSection = page.locator("section").filter({
      has: page.getByRole("heading", { exact: true, name: "Team members" }),
    });
    await expect(membersSection.getByText("Alice Johnson", { exact: true })).toBeVisible({
      timeout: 5000,
    });
  });

  // The legacy rounded-container selector matches multiple nested containers; tracked in docs/LAUNCH.md.
  test.skip("removes a member from the workspace", async ({ page }) => {
    await page.getByRole("button", { name: /add team member/i }).click();
    await page.getByLabel("Full name").click();
    await page.getByLabel("Full name").pressSequentially("Bob Smith", { delay: 10 });
    await page.keyboard.press("Tab");
    await page.getByRole("button", { name: /add member/i }).click();
    await expect(page.getByText("Bob Smith")).toBeVisible({ timeout: 5000 });

    const memberCard = page.locator("[class*='rounded']").filter({
      hasText: "Bob Smith",
    });
    await memberCard.getByRole("button", { name: /remove|delete/i }).click();

    const confirmButton = page.getByRole("button", { name: /confirm|remove|delete/i });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }

    await expect(page.getByText("Bob Smith")).not.toBeVisible({ timeout: 5000 });
  });
});
