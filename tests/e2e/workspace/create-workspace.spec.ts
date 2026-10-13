import { instant } from "@next/playwright";

import { test, expect } from "../fixtures/workspace.fixture";
import { holdScripts } from "../helpers/hold-scripts";

test.describe("Create Workspace", () => {
  test("creates a new workspace and navigates to it", async ({ homePage, page }) => {
    await homePage.goto();

    await expect(homePage.getCreateWorkspaceButton()).toBeVisible();
    await homePage.createWorkspace();

    await expect(page).toHaveURL(/\/[a-f0-9-]+/, { timeout: 10_000 });

    await expect(page.getByRole("heading", { name: /team members/i })).toBeVisible();
  });

  test("keeps the create button disabled until it hydrates", async ({ homePage, page }) => {
    const releaseScripts = await holdScripts(page);
    await page.goto("/", { waitUntil: "commit" });
    await expect(homePage.getCreateWorkspaceButton()).toBeDisabled();

    releaseScripts();
    await homePage.createWorkspace();

    await expect(page).toHaveURL(/\/[a-f0-9-]+/, { timeout: 10_000 });
  });

  test("new workspace appears in the active workspaces list", async ({ homePage, page }) => {
    await homePage.goto();
    await homePage.createWorkspace();

    await expect(page).toHaveURL(/\/[a-f0-9-]+/, { timeout: 10_000 });

    await page.goto("/");

    await expect(homePage.getActiveWorkspacesHeading()).toBeVisible({ timeout: 10_000 });
  });

  test("serves the workspace shell instantly when opened from active workspaces", async ({
    homePage,
    page,
  }) => {
    await homePage.goto();
    await homePage.createWorkspace();

    await expect(page).toHaveURL(/\/[a-f0-9-]+/, { timeout: 10_000 });
    const teamId = new URL(page.url()).pathname.slice(1);

    await page.goto("/");
    await expect(homePage.getActiveWorkspacesHeading()).toBeVisible({ timeout: 10_000 });

    const teamMembersHeading = page.getByRole("heading", { name: /team members/i });

    await instant(page, async () => {
      try {
        await homePage.getTeamLink(teamId).click();
        await page.waitForURL(`/${teamId}`);
        await expect(teamMembersHeading).toBeHidden();
      } finally {
        await page.evaluate(() => {
          // oxlint-disable-next-line unicorn/no-document-cookie -- WebKit needs an in-page deletion to notify Next's test lock.
          document.cookie = "next-instant-navigation-testing=; path=/; max-age=0";
        });
      }
    });

    await expect(teamMembersHeading).toBeVisible({ timeout: 10_000 });
  });
});

test("requires a workspace name and displays the chosen name", async ({ homePage, page }) => {
  await homePage.goto();
  await homePage.getCreateWorkspaceButton().click();
  await page.getByRole("button", { exact: true, name: "Create workspace" }).click();
  await expect(page.getByText("Workspace name is required")).toBeVisible();
  await page.getByLabel("Workspace name").fill("E2E Named Workspace");
  await page.getByRole("button", { exact: true, name: "Create workspace" }).click();
  await expect(
    page.getByRole("heading", { exact: true, name: "E2E Named Workspace" }),
  ).toBeVisible();
});
