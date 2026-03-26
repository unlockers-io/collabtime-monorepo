import { execSync } from "node:child_process";

import { defineConfig, devices } from "@playwright/test";

const getPortlessUrl = (name: string) => {
  if (process.env.CI) {
    return undefined;
  }

  try {
    return execSync(`portless get ${name}`).toString().trim();
  } catch {
    return undefined;
  }
};

const webUrl = getPortlessUrl("collabtime.web") ?? "http://localhost:3000";

export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  globalTeardown: "./tests/e2e/teardown/cleanup.ts",
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      dependencies: ["setup"],
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/user.json",
      },
    },
    {
      dependencies: ["setup"],
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        storageState: "tests/e2e/.auth/user.json",
      },
    },
    {
      dependencies: ["setup"],
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        storageState: "tests/e2e/.auth/user.json",
      },
    },
  ],
  reporter: process.env.CI ? [["html", { open: "never" }]] : [["list"], ["html"]],
  retries: process.env.CI ? 2 : 0,
  testDir: "./tests/e2e",
  use: {
    baseURL: webUrl,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: process.env.CI ? "pnpm --filter web start" : "pnpm run dev --filter=web",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: webUrl,
    },
  ],
  workers: process.env.CI ? 1 : undefined,
});
