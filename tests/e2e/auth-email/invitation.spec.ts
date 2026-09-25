import { expect, test } from "@playwright/test";

import { webUrl } from "../../../playwright.config";
import { extractLink, waitForEmail } from "../helpers/resend";
import { makeTestEmail } from "../helpers/test-email";
import { HomePage } from "../pages/home.page";

test.skip(!process.env.RESEND_API_KEY, "needs RESEND_API_KEY (test mode)");
test("invitation email carries a guest through signup and acceptance", async ({
  browser,
  page,
}, testInfo) => {
  const email = makeTestEmail(testInfo);
  const sinceMs = Date.now();
  await page.goto("/");
  await new HomePage(page).createWorkspace("E2E Invitation Workspace");
  await expect(page).toHaveURL(/\/[a-f0-9-]{36}$/);
  const teamId = new URL(page.url()).pathname.slice(1);
  await page.getByRole("button", { name: /add team member/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("Invited Friend");
  await dialog.getByLabel(/Email/).fill(email);
  await dialog.getByRole("button", { exact: true, name: "Add member" }).click();
  await expect(page.getByText("Invited", { exact: true })).toBeVisible();
  const mail = await waitForEmail({ sinceMs, subject: /invited you to join/i, to: email });
  const link = extractLink(mail, /\?invite=/);
  const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const guestPage = await guest.newPage();
    await guestPage.goto(link);
    await guestPage.getByRole("link", { exact: true, name: "Create account" }).click();
    await guestPage.getByLabel("Full Name").fill("Invited Friend");
    await guestPage.getByLabel("Email", { exact: true }).fill(email);
    await guestPage.getByLabel("Password", { exact: true }).fill("SecurePassword1!");
    await guestPage.getByRole("button", { name: /create account/i }).click();
    await expect(guestPage.getByText(/check your email/i)).toBeVisible();
    const verification = await waitForEmail({ sinceMs, subject: /verify/i, to: email });
    await guestPage.goto(extractLink(verification, /\/api\/auth\/verify-email\?token=/));
    await expect(guestPage).toHaveURL(link);
    await expect(
      guestPage.getByText("You've been invited to E2E Invitation Workspace"),
    ).toBeVisible();
    await guestPage.getByRole("button", { name: "Accept invitation" }).click();
    await expect(guestPage.getByText("You are a member of this team")).toBeVisible();
    await page.goto(`${webUrl}/${teamId}`);
    await expect(page.getByText("Invited", { exact: true })).toHaveCount(0);
  } finally {
    await guest.close();
  }
});
