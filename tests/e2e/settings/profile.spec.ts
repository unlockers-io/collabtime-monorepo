import { test, expect } from "../fixtures/workspace.fixture";
import { holdScripts } from "../helpers/hold-scripts";

test.describe("Settings profile form", () => {
  test("keeps the form disabled until it hydrates", async ({ page }) => {
    const nameInput = page.getByLabel("Full name");

    const releaseScripts = await holdScripts(page);
    await page.goto("/settings", { waitUntil: "commit" });
    await expect(nameInput).toBeDisabled();

    releaseScripts();
    await nameInput.fill("Renamed Workspace User");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Name updated")).toBeVisible();
    await expect(nameInput).toHaveValue("Renamed Workspace User");
  });
});
