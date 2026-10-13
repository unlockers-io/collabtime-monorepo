import { expect, test } from "../fixtures/workspace.fixture";
import { holdScripts } from "../helpers/hold-scripts";
import { extractLink, waitForEmail } from "../helpers/resend";
import { makeTestEmail } from "../helpers/test-email";
import { HomePage } from "../pages/home.page";
import { webUrl } from "../urls";

test.skip(!process.env.RESEND_API_KEY, "needs RESEND_API_KEY (test mode)");

const SPACE_PASSWORD = "SpacePassword1!";

test.describe("Private space password self-join", () => {
  test("password → signup makes the team appear on the homepage, device-independently", async ({
    browser,
    page: ownerPage,
  }, testInfo) => {
    const since = Date.now();
    const email = makeTestEmail(testInfo);

    const owner = ownerPage.context();
    await ownerPage.goto(`${webUrl}/`);
    await new HomePage(ownerPage).createWorkspace();
    await expect(ownerPage).toHaveURL(/\/[a-f0-9-]{36}$/u, { timeout: 15_000 });
    const teamId = new URL(ownerPage.url()).pathname.slice(1);

    const spacesResponse = await owner.request.get(`${webUrl}/api/spaces`);
    const { spaces } = (await spacesResponse.json()) as {
      spaces: Array<{ id: string; teamId: string }>;
    };
    const space = spaces.find((s) => s.teamId === teamId);
    expect(space).toBeTruthy();

    const patch = await owner.request.patch(`${webUrl}/api/spaces/${space?.id}`, {
      data: { password: SPACE_PASSWORD, visibility: "private" },
    });
    expect(patch.ok()).toBeTruthy();
    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await guest.newPage();
    const releaseScripts = await holdScripts(page);
    try {
      await page.goto(`${webUrl}/${teamId}`, { waitUntil: "commit" });
      await expect(
        page.getByRole("heading", { includeHidden: true, name: /private workspace/i }),
      ).toBeAttached();
      await expect(page.getByLabel("Password")).toBeDisabled();
      await expect(
        page.getByRole("button", { includeHidden: true, name: /^continue$/i }),
      ).toBeDisabled();
      releaseScripts();
      await page.getByLabel("Password").fill(SPACE_PASSWORD);
      await page.getByRole("button", { name: /^continue$/i }).click();

      const signUpToJoin = page.getByRole("link", { name: /create account to join/i });
      await expect(signUpToJoin).toBeVisible();
      await expect(signUpToJoin).toHaveAttribute(
        "href",
        `/register?redirect=${encodeURIComponent(`/${teamId}`)}`,
      );
      await signUpToJoin.click();

      await expect(page).toHaveURL(/\/register/u);
      await page.getByLabel("Full Name").fill("Gate Joiner");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill("SecurePassword1!");
      await page.getByRole("button", { name: /create account/i }).click();
      await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10_000 });

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
      await expect(clickerPage.getByRole("heading", { name: "Active workspaces" })).toBeVisible({
        timeout: 15_000,
      });
      await clicker.close();
    } finally {
      releaseScripts();
      await guest.close();
    }
  });
});
