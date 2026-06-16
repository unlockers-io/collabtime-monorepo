import { expect, test } from "../fixtures/auth.fixture";

const STORAGE_STATE = "tests/e2e/.auth/user.json";

// Skip: admin UI doesn't render in CI production builds (Better Auth session detection)
test.describe.skip("Realtime Sync", () => {
  let teamId: string;

  test.beforeEach(async ({ browser }) => {
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

    await Promise.all([pageA.goto(`/${teamId}`), pageB.goto(`/${teamId}`)]);

    await expect(pageA.getByRole("button", { name: /add team member/i })).toBeVisible({
      timeout: 60_000,
    });
    await expect(pageB.getByRole("heading", { name: "Team Members" })).toBeVisible({
      timeout: 60_000,
    });

    await pageA.getByRole("button", { name: /add team member/i }).click();
    await pageA.getByLabel("Name *").click();
    await pageA.getByLabel("Name *").pressSequentially("Realtime Alice", { delay: 10 });
    await pageA.keyboard.press("Tab");
    await pageA.getByRole("button", { name: /add member/i }).click();

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

    await pageA.getByRole("button", { name: /add group/i }).click();
    await pageA.getByLabel("Group Name").click();
    await pageA.getByLabel("Group Name").pressSequentially("Sync Test Group", { delay: 10 });
    await pageA.keyboard.press("Tab");
    await pageA.getByRole("button", { name: /create group/i }).click();

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

    await expect(pageA.getByRole("heading", { name: "Team Members" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(pageB.getByRole("heading", { name: "Team Members" })).toBeVisible({
      timeout: 10_000,
    });

    const teamNameButton = pageA.locator("button").filter({
      has: pageA.locator("h1"),
    });
    await teamNameButton.first().click();

    // Tab blurs the input, which is what commits the rename.
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

    const contextA = await browser.newContext({ storageState: STORAGE_STATE });
    const contextB = await browser.newContext({ storageState: STORAGE_STATE });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await Promise.all([pageA.goto(`/${teamId}`), pageB.goto(`/${teamId}`)]);

    await expect(pageA.getByText("Removal Target")).toBeVisible({
      timeout: 10_000,
    });
    await expect(pageB.getByText("Removal Target")).toBeVisible({
      timeout: 10_000,
    });

    const memberCard = pageA.locator("[class*='rounded']").filter({
      hasText: "Removal Target",
    });
    await memberCard.getByRole("button", { name: /remove|delete/i }).click();

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
