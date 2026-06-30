import { expect, test } from "@playwright/test";

import { webUrl } from "../../../playwright.config";
import { verification } from "../fixtures/verification.fixture";
import { extractLink, waitForEmail } from "../helpers/resend";
import { makeTestEmail } from "../helpers/test-email";

test.skip(!process.env.RESEND_API_KEY, "needs RESEND_API_KEY (test mode)");

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Password reset", () => {
  test("user can request reset, set a new password, and sign in", async ({
    page,
    request,
  }, testInfo) => {
    await page.context().clearCookies();

    const email = makeTestEmail(testInfo);
    const originalPassword = "OriginalPassword1!";
    const newPassword = "BrandNewPassword2!";

    // Welcome-email delivery is covered by sign-up-verification.spec.ts; bypass here.
    const signUp = await request.post(`${webUrl}/api/auth/sign-up/email`, {
      data: { email, name: "Reset Me", password: originalPassword },
    });
    expect([200, 201]).toContain(signUp.status());
    const verify = await verification.forVerifyEmail(email);
    await page.goto(verify.url);
    await page.context().clearCookies();

    // Cutoff must be after the welcome email so we don't pick it up.
    const since = Date.now();

    const reset = await request.post(`${webUrl}/api/auth/request-password-reset`, {
      data: { email, redirectTo: "/reset-password" },
    });
    expect(reset.status()).toBe(200);

    // Assert the reset email actually left Resend — covers the "200 but never delivered" bug class.
    const mail = await waitForEmail({
      sinceMs: since,
      subject: /reset/i,
      to: email,
    });
    expect(mail.last_event).not.toBe("bounced");

    // Better Auth puts the token as a path segment, then redirects to /reset-password?token=...
    const resetUrl = extractLink(mail, /\/reset-password\/[^"?]+\?callbackURL=/v);
    await page.goto(resetUrl);

    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel(/confirm password/i).fill(newPassword);
    await page.getByRole("button", { name: /reset password/i }).click();

    await page.waitForURL(/\/login/);

    await page.getByLabel("Email").fill(email);
    // Exact match: Instant Navigations keeps the outgoing reset-password page in
    // the DOM (hidden) during the soft transition, so a substring "Password"
    // match also resolves its "New password"/"Confirm password" inputs.
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL("/");
    await expect(page.getByRole("button", { name: /create team workspace/i })).toBeVisible();
  });
});
