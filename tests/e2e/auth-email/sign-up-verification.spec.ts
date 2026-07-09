import { expect, test } from "@playwright/test";

import { webUrl } from "../../../playwright.config";
import { extractLink, waitForEmail } from "../helpers/resend";
import { makeTestEmail } from "../helpers/test-email";

// Skip the whole suite when Resend isn't configured. Without RESEND_API_KEY,
// the auth server runs with requireEmailVerification: false, which is a
// different code path — these tests would assert against the wrong behavior.
test.skip(!process.env.RESEND_API_KEY, "needs RESEND_API_KEY (test mode)");

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Sign-up email verification", () => {
  test("verify email is sent, clicking the link signs in the clicking device", async ({
    browser,
    request,
  }, testInfo) => {
    const since = Date.now();
    const email = makeTestEmail(testInfo);
    const password = "SecurePassword1!";

    const signUp = await request.post(`${webUrl}/api/auth/sign-up/email`, {
      data: {
        email,
        name: "Verify Me",
        password,
      },
    });
    expect([200, 201]).toContain(signUp.status());

    // Pre-verification: signIn fails (Better Auth blocks unverified users)
    // and, with sendOnSignIn, re-sends a fresh verification link alongside
    // the 403 — so a SECOND verification email may exist by the time
    // waitForEmail resolves. Either link verifies; the spec doesn't care
    // which one it follows.
    const preSignIn = await request.post(`${webUrl}/api/auth/sign-in/email`, {
      data: { email, password },
      failOnStatusCode: false,
    });
    expect(preSignIn.status()).not.toBe(200);

    const mail = await waitForEmail({
      sinceMs: since,
      subject: /verify/i,
      to: email,
    });
    expect(mail.last_event).not.toBe("bounced");

    // Follow the link in a fresh BrowserContext. The link IS the login:
    // autoSignInAfterVerification mints a session on the clicking device and
    // the callback lands on the app root.
    const verifyUrl = extractLink(mail, /\/api\/auth\/verify-email\?token=/v);
    const clickerContext = await browser.newContext();
    const clickerPage = await clickerContext.newPage();
    await clickerPage.goto(verifyUrl);
    await expect(clickerPage).toHaveURL(`${webUrl}/`);
    // Cookie name may gain the __Secure- prefix under HTTPS (portless dev),
    // so match on the prefix anywhere in the name rather than startsWith.
    const clickerCookies = await clickerContext.cookies(webUrl);
    expect(clickerCookies.find((c) => c.name.includes("collabtime."))).toBeDefined();
    await clickerContext.close();

    const postSignIn = await request.post(`${webUrl}/api/auth/sign-in/email`, {
      data: { email, password },
    });
    expect(postSignIn.status()).toBe(200);
  });
});
