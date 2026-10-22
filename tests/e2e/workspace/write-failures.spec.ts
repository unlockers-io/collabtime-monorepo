import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/workspace.fixture";

const rejectSubmission = async (page: Page, draft: string) => {
  const route = async (request: Route) => {
    const matches =
      request.request().headers()["next-action"] !== undefined &&
      request.request().postData()?.includes(draft) === true;

    await (matches ? request.abort("failed") : request.continue());
  };

  await page.route("**/*", route);

  return () => page.unroute("**/*", route);
};

test("CSV import keeps rows and becomes retryable after a transport failure", async ({
  homePage,
  page,
}) => {
  await homePage.goto();
  await homePage.createWorkspace();
  await expect(page).toHaveURL(/\/[a-f0-9-]{36}$/);
  await page.getByRole("button", { exact: true, name: "Import from CSV" }).click();
  await page
    .getByLabel("Paste CSV data here")
    .fill("name,timezone,title,work_start,work_end\nRetry Alice,Europe/Berlin,Engineer,9,17");
  await page.getByRole("button", { exact: true, name: "Preview" }).click();
  const restoreNetwork = await rejectSubmission(page, "Retry Alice");
  await page.getByRole("button", { exact: true, name: "Import 1 member" }).click();
  await expect(
    page.getByText("Could not save your changes. Check your connection and try again.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Retry Alice", { exact: true })).toBeVisible();
  const retry = page.getByRole("button", { exact: true, name: "Import 1 member" });
  await expect(retry).toBeEnabled();
  await restoreNetwork();
  await retry.click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { exact: true, name: "Retry Alice" })).toBeVisible();
});

test("add group keeps the form usable after a transport failure", async ({ homePage, page }) => {
  await homePage.goto();
  await homePage.createWorkspace();
  await expect(page).toHaveURL(/\/[a-f0-9-]{36}$/);
  await page.getByRole("button", { exact: true, name: "Add group" }).click();
  await page.getByLabel("Group name").fill("Retry Group");
  await page.keyboard.press("Tab");
  const restoreNetwork = await rejectSubmission(page, "Retry Group");
  await page.getByRole("button", { exact: true, name: "Create group" }).click();
  await expect(
    page.getByText("Could not save your changes. Check your connection and try again.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Group name")).toHaveValue("Retry Group");
  const retry = page.getByRole("button", { exact: true, name: "Create group" });
  await expect(retry).toBeEnabled();
  await restoreNetwork();
  await retry.click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { exact: true, name: "Rename Retry Group" })).toBeVisible();
});
