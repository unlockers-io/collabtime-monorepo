import { expect, test } from "@playwright/test";

import { webUrl } from "../../../playwright.config";
import { verification } from "../fixtures/verification.fixture";
import { makeTestEmail } from "../helpers/test-email";

// Skip the whole suite when Resend isn't configured. Without RESEND_API_KEY,
// the auth server runs with requireEmailVerification: false, which is a
// different code path — these tests would assert against the wrong behavior.
test.skip(!process.env.RESEND_API_KEY, "needs RESEND_API_KEY (test mode)");

// Registration tests need a clean auth state.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Sign-up email verification", () => {
  test("user can sign up, click the verification link, and reach home authenticated", async ({
    page,
    request,
  }, testInfo) => {
    await page.context().clearCookies();

    const email = makeTestEmail(testInfo);
    const password = "SecurePassword1!";

    const signUp = await request.post(`${webUrl}/api/auth/sign-up/email`, {
      data: { email, name: "Verify Me", password },
    });
    // 200/201 with requireEmailVerification:true. Better Auth returns user
    // shape but no session cookie — confirmed by the redirect below.
    expect([200, 201]).toContain(signUp.status());

    // Pre-verification: visiting / shows the unauthenticated home (Get Started)
    // rather than the create-workspace CTA.
    await page.goto("/");
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();

    const { url } = await verification.forVerifyEmail(email);
    await page.goto(url);

    // verify-email handler redirects to callbackURL (=/) and sets a session
    // cookie. End state: authenticated, on home with the create-workspace CTA.
    await page.waitForURL("/");
    await expect(page.getByRole("button", { name: /create team workspace/i })).toBeVisible();
  });
});
