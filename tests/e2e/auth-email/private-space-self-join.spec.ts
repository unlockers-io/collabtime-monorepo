import { expect, test } from "@playwright/test";

import { webUrl } from "../../../playwright.config";
import { extractLink, waitForEmail } from "../helpers/resend";
import { makeTestEmail } from "../helpers/test-email";

// Skip without Resend: the cross-device verification step (the whole point of
// this spec) only exists when requireEmailVerification is on, which is gated on
// RESEND_API_KEY. Mirrors sign-up-redirect.spec.ts.
test.skip(!process.env.RESEND_API_KEY, "needs RESEND_API_KEY (test mode)");

test.use({ storageState: { cookies: [], origins: [] } });

const SPACE_PASSWORD = "SpacePassword1!";

test.describe("Private space password self-join", () => {
  test("password → signup makes the team appear on the homepage, device-independently", async ({
    browser,
    page,
  }, testInfo) => {
    const since = Date.now();
    const email = makeTestEmail(testInfo);

    const owner = await browser.newContext({ storageState: "tests/e2e/.auth/user.json" });
    const ownerPage = await owner.newPage();
    await ownerPage.goto(`${webUrl}/`);
    await ownerPage.getByRole("button", { name: /create team workspace/i }).click();
    await expect(ownerPage).toHaveURL(/\/[a-f0-9-]{36}$/u, { timeout: 15_000 });
    const teamId = new URL(ownerPage.url()).pathname.slice(1);

    const spacesResponse = await owner.request.get(`${webUrl}/api/spaces`);
    const { spaces } = (await spacesResponse.json()) as {
      spaces: Array<{ id: string; teamId: string }>;
    };
    const space = spaces.find((s) => s.teamId === teamId);
    expect(space).toBeTruthy();

    const patch = await owner.request.patch(`${webUrl}/api/spaces/${space?.id}`, {
      data: { accessPassword: SPACE_PASSWORD, isPrivate: true, updatePassword: true },
    });
    expect(patch.ok()).toBeTruthy();
    await owner.close();

    await page.goto(`${webUrl}/${teamId}`);
    await expect(page.getByRole("heading", { name: /private team/i })).toBeVisible();
    await page.getByLabel("Password").fill(SPACE_PASSWORD);
    await page.getByRole("button", { name: /^continue$/i }).click();

    const signUpToJoin = page.getByRole("link", { name: /sign up to join/i });
    await expect(signUpToJoin).toBeVisible();
    await expect(signUpToJoin).toHaveAttribute(
      "href",
      `/signup?redirect=${encodeURIComponent(`/${teamId}`)}`,
    );
    await signUpToJoin.click();

    await expect(page).toHaveURL(/\/signup/u);
    // The space-access cookie from the gate rides with signUp so user.create.after joins the team.
    await page.getByLabel("Full Name").fill("Gate Joiner");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("SecurePassword1!");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10_000 });

    // Verification on a context that never held the space-access cookie proves
    // membership was created at signup, not when the link is clicked.
    const mail = await waitForEmail({ sinceMs: since, subject: /verify/i, to: email });
    expect(mail.last_event).not.toBe("bounced");
    const verifyUrl = extractLink(mail, /\/api\/auth\/verify-email\?token=/);

    const clicker = await browser.newContext();
    const clickerPage = await clicker.newPage();
    await clickerPage.goto(verifyUrl);
    await expect(clickerPage).toHaveURL(`${webUrl}/${teamId}`);
    await expect(clickerPage.getByRole("heading", { name: /team members/i })).toBeVisible({
      timeout: 15_000,
    });

    await clickerPage.goto(`${webUrl}/`);
    await expect(clickerPage.getByRole("heading", { name: "My Teams" })).toBeVisible({
      timeout: 15_000,
    });
    await clicker.close();
  });
});
