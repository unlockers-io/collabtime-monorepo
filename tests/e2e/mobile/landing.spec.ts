import { expect, test } from "@playwright/test";

test("landing fits a phone and the primary CTA opens signup", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Find the hour everyone is awake" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { exact: true, name: "Open source" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("link", { exact: true, name: "Create a workspace" }).first().click();
  await expect(page).toHaveURL(/\/register/);
  await expect(page.getByLabel("Email")).toBeVisible();
});
