import { test, expect } from "../fixtures/workspace.fixture";

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

  test("removes a member from the workspace", async ({ page }) => {
    await page.getByRole("button", { name: /add team member/i }).click();
    await page.getByLabel("Full name").click();
    await page.getByLabel("Full name").pressSequentially("Bob Smith", { delay: 10 });
    await page.keyboard.press("Tab");
    await page.getByRole("button", { name: /add member/i }).click();

    const membersSection = page.locator("section").filter({
      has: page.getByRole("heading", { exact: true, name: "Team members" }),
    });

    const bob = membersSection.getByText("Bob Smith", { exact: true });
    await expect(bob).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "More actions for Bob Smith" }).click();
    await page.getByRole("menuitem", { name: "Remove from workspace" }).click();
    await page.getByRole("button", { exact: true, name: "Remove member" }).click();

    await expect(bob).toBeHidden({ timeout: 5000 });
  });
});
