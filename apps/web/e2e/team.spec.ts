import { test, expect, Page } from "@playwright/test";

/**
 * Helper to create a team and get authenticated
 */
const createTeamAndAuth = async (
  page: Page,
  password = "testpassword123"
): Promise<string> => {
  await page.goto("/");

  // Click create team button
  const createButton = page.getByRole("button", { name: /create/i });
  await createButton.click();

  // Fill in password
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(password);

  // Submit
  const submitButton = page.getByRole("button", { name: /create/i }).last();
  await submitButton.click();

  // Wait for navigation to team page
  await page.waitForURL(/\/[0-9a-f-]+/);

  // Return the team URL
  return page.url();
};

test.describe("Team Page", () => {
  test("should display empty team state for new team", async ({ page }) => {
    await createTeamAndAuth(page);

    // Should show empty state message
    await expect(page.getByText(/build your team/i)).toBeVisible();
  });

  test("should allow admin to add member", async ({ page }) => {
    await createTeamAndAuth(page);

    // Click add member button
    const addMemberButton = page.getByRole("button", { name: /add member/i });
    await addMemberButton.click();

    // Fill in member details
    await page.locator('input[name="name"]').fill("John Doe");
    await page.locator('input[name="title"]').fill("Software Engineer");

    // Select timezone (first option)
    const timezoneSelect = page.locator('button[role="combobox"]').first();
    await timezoneSelect.click();
    const firstOption = page.getByRole("option").first();
    await firstOption.click();

    // Submit the form
    const submitButton = page
      .getByRole("button", { name: /add member/i })
      .last();
    await submitButton.click();

    // Should show the new member
    await expect(page.getByText("John Doe")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Software Engineer")).toBeVisible();
  });

  test("should show member count badge", async ({ page }) => {
    await createTeamAndAuth(page);

    // Initially should show 0 members
    await expect(page.getByText("0")).toBeVisible();

    // Add a member
    const addMemberButton = page.getByRole("button", { name: /add member/i });
    await addMemberButton.click();

    await page.locator('input[name="name"]').fill("Jane Doe");
    await page.locator('input[name="title"]').fill("Designer");

    const timezoneSelect = page.locator('button[role="combobox"]').first();
    await timezoneSelect.click();
    await page.getByRole("option").first().click();

    await page.getByRole("button", { name: /add member/i }).last().click();

    // Should now show 1 member
    await expect(
      page.locator(".rounded-full").filter({ hasText: "1" })
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Team Admin Authentication", () => {
  test("should show view-only mode for unauthenticated users", async ({
    page,
  }) => {
    // Create a team first
    const teamUrl = await createTeamAndAuth(page);
    const teamId = teamUrl.split("/").pop();

    // Clear cookies to simulate new visitor
    await page.context().clearCookies();

    // Visit the team page again
    await page.goto(`/${teamId}`);

    // Should show view-only message
    await expect(page.getByText(/view-only/i)).toBeVisible();

    // Should show unlock button
    await expect(
      page.getByRole("button", { name: /unlock admin/i })
    ).toBeVisible();
  });

  test("should allow unlocking with correct password", async ({ page }) => {
    const password = "myteampassword";

    // Create a team
    const teamUrl = await createTeamAndAuth(page, password);
    const teamId = teamUrl.split("/").pop();

    // Clear cookies
    await page.context().clearCookies();

    // Visit team page
    await page.goto(`/${teamId}`);

    // Click unlock button
    await page.getByRole("button", { name: /unlock admin/i }).click();

    // Fill in password
    await page.locator('input[type="password"]').fill(password);

    // Click unlock in dialog
    await page.getByRole("button", { name: /unlock/i }).last().click();

    // Should now see admin controls
    await expect(
      page.getByRole("button", { name: /add member/i })
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Team Groups", () => {
  test("should allow creating a group", async ({ page }) => {
    await createTeamAndAuth(page);

    // Click add group button
    const addGroupButton = page.getByRole("button", { name: /add group/i });
    await addGroupButton.click();

    // Fill in group name
    await page.locator('input[name="name"]').fill("Engineering");

    // Submit
    await page.getByRole("button", { name: /create/i }).last().click();

    // Should show the new group
    await expect(page.getByText("Engineering")).toBeVisible({ timeout: 5000 });
  });
});
