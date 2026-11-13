import { expect, test } from "@playwright/test";

import { verificationLink } from "../fixtures/verification.fixture";
import { holdScripts } from "../helpers/hold-scripts";
import { makeTestEmail } from "../helpers/test-email";
import { webUrl } from "../urls";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Sign-up with redirect context", () => {
  test("?redirect= survives signup and the verification link lands there signed in", async ({
    browser,
    page,
  }, testInfo) => {
    const since = Date.now();
    const email = makeTestEmail(testInfo);
    const redirectPath = "/settings";

    const releaseScripts = await holdScripts(page);

    try {
      await page.goto(`${webUrl}/register?redirect=${encodeURIComponent(redirectPath)}`, {
        waitUntil: "commit",
      });
      await expect(page.getByLabel("Full Name")).toBeDisabled();
      await expect(page.getByLabel("Email")).toBeDisabled();
      await expect(page.getByLabel("Password")).toBeDisabled();
      await expect(
        page.getByRole("button", { includeHidden: true, name: /create account/i }),
      ).toBeDisabled();
    } finally {
      releaseScripts();
    }

    await expect(page.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      `/login?redirect=${encodeURIComponent(redirectPath)}`,
    );

    await page.getByLabel("Full Name").fill("Redirect Me");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("SecurePassword1!");
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10_000 });

    const verifyUrl = await verificationLink({ sinceMs: since, subject: /verify/i, to: email });
    const clickerContext = await browser.newContext();
    const clickerPage = await clickerContext.newPage();
    await clickerPage.goto(verifyUrl);
    await expect(clickerPage).toHaveURL(`${webUrl}${redirectPath}`);
    const clickerCookies = await clickerContext.cookies(webUrl);
    expect(clickerCookies.find((c) => c.name.includes("collabtime."))).toBeDefined();
    await clickerContext.close();
  });
});
