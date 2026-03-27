import { expect, test } from "../fixtures";

const STORAGE_STATE = "tests/e2e/.auth/user.json";

// TODO: Admin UI doesn't render in CI — Better Auth session detection issue
// See: https://github.com/unlockers-io/collabtime-monorepo/issues/TBD
test.describe.skip("Realtime Sync", () => {
  let teamId: string;

  test.beforeEach(async ({ browser }) => {
    // Create a workspace in context A
    const contextA = await browser.newContext({ storageState: STORAGE_STATE });
    const pageA = await contextA.newPage();
    await pageA.goto("/");
    await pageA.getByRole("button", { name: /create team workspace/i }).click();
    await expect(pageA).toHaveURL(/\/[a-f0-9-]+/, { timeout: 10_000 });
    teamId = new URL(pageA.url()).pathname.slice(1);
    await contextA.close();
  });

  test("member added syncs to second browser", async ({ browser }) => {
    const contextA = await browser.newContext({ storageState: STORAGE_STATE });
    const contextB = await browser.newContext({ storageState: STORAGE_STATE });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Both open the same team page
    await Promise.all([pageA.goto(`/${teamId}`), pageB.goto(`/${teamId}`)]);

    // Wait for pages to load
    await expect(pageA.getByRole("button", { name: /add team member/i })).toBeVisible({
      timeout: 60_000,
    });
    await expect(pageB.getByRole("heading", { name: "Team Members" })).toBeVisible({
      timeout: 60_000,
    });

    // Context A adds a member
    await pageA.getByRole("button", { name: /add team member/i }).click();
    await pageA.getByLabel("Name *").click();
    await pageA.getByLabel("Name *").pressSequentially("Realtime Alice", { delay: 10 });
    await pageA.keyboard.press("Tab");
    await pageA.getByRole("button", { name: /add member/i }).click();

    // Verify member appears in context A
    await expect(pageA.getByText("Realtime Alice")).toBeVisible({
      timeout: 5000,
    });

    // Verify member appears in context B via realtime
    await expect(pageB.getByText("Realtime Alice")).toBeVisible({
      timeout: 15_000,
    });

    await contextA.close();
    await contextB.close();
  });

  test("group created syncs to second browser", async ({ browser }) => {
    const contextA = await browser.newContext({ storageState: STORAGE_STATE });
    const contextB = await browser.newContext({ storageState: STORAGE_STATE });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await Promise.all([pageA.goto(`/${teamId}`), pageB.goto(`/${teamId}`)]);

    await expect(pageA.getByRole("button", { name: /add group/i })).toBeVisible({
      timeout: 60_000,
    });
    await expect(pageB.getByRole("heading", { name: "Groups" })).toBeVisible({
      timeout: 60_000,
    });

    // Context A creates a group
    await pageA.getByRole("button", { name: /add group/i }).click();
    await pageA.getByLabel("Group Name").click();
    await pageA.getByLabel("Group Name").pressSequentially("Sync Test Group", { delay: 10 });
    await pageA.keyboard.press("Tab");
    await pageA.getByRole("button", { name: /create group/i }).click();

    // Verify group appears in context A
    await expect(pageA.getByText("Sync Test Group")).toBeVisible({
      timeout: 5000,
    });

    // Verify group appears in context B via realtime
    await expect(pageB.getByText("Sync Test Group")).toBeVisible({
      timeout: 15_000,
    });

    await contextA.close();
    await contextB.close();
  });

  test("team name change syncs to second browser", async ({ browser }) => {
    const contextA = await browser.newContext({ storageState: STORAGE_STATE });
    const contextB = await browser.newContext({ storageState: STORAGE_STATE });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await Promise.all([pageA.goto(`/${teamId}`), pageB.goto(`/${teamId}`)]);

    // Wait for team page to load in both contexts
    await expect(pageA.getByRole("heading", { name: "Team Members" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(pageB.getByRole("heading", { name: "Team Members" })).toBeVisible({
      timeout: 10_000,
    });

    // Context A edits the team name (click the team name heading to start editing)
    const teamNameButton = pageA.locator("button").filter({
      has: pageA.locator("h1"),
    });
    await teamNameButton.first().click();

    // Fill the name input and save (blur triggers save)
    const nameInput = pageA.locator('input[placeholder="Team name…"]');
    await nameInput.clear();
    await nameInput.pressSequentially("Synced Team Name", { delay: 10 });
    await pageA.keyboard.press("Tab");

    // Verify name appears in context B via realtime
    await expect(pageB.getByText("Synced Team Name")).toBeVisible({
      timeout: 15_000,
    });

    await contextA.close();
    await contextB.close();
  });

  test("member removed syncs to second browser", async ({ browser }) => {
    // First add a member using context A alone
    const setupContext = await browser.newContext({
      storageState: STORAGE_STATE,
    });
    const setupPage = await setupContext.newPage();
    await setupPage.goto(`/${teamId}`);
    await setupPage.getByRole("button", { name: /add team member/i }).click();
    await setupPage.getByLabel("Name *").click();
    await setupPage.getByLabel("Name *").pressSequentially("Removal Target", { delay: 10 });
    await setupPage.keyboard.press("Tab");
    await setupPage.getByRole("button", { name: /add member/i }).click();
    await expect(setupPage.getByText("Removal Target")).toBeVisible({
      timeout: 5000,
    });
    await setupContext.close();

    // Now open two contexts
    const contextA = await browser.newContext({ storageState: STORAGE_STATE });
    const contextB = await browser.newContext({ storageState: STORAGE_STATE });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await Promise.all([pageA.goto(`/${teamId}`), pageB.goto(`/${teamId}`)]);

    // Verify member is visible in both
    await expect(pageA.getByText("Removal Target")).toBeVisible({
      timeout: 10_000,
    });
    await expect(pageB.getByText("Removal Target")).toBeVisible({
      timeout: 10_000,
    });

    // Context A removes the member
    const memberCard = pageA.locator("[class*='rounded']").filter({
      hasText: "Removal Target",
    });
    await memberCard.getByRole("button", { name: /remove|delete/i }).click();

    // Confirm if needed
    const confirmButton = pageA.getByRole("button", {
      name: /confirm|remove|delete/i,
    });
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // Verify member disappears in context B via realtime
    await expect(pageB.getByText("Removal Target")).not.toBeVisible({
      timeout: 15_000,
    });

    await contextA.close();
    await contextB.close();
  });
});
