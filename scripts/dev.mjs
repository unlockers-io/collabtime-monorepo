import { spawnSync } from "node:child_process";

import { applyPortlessUrls } from "./portless-env.mjs";

const env = applyPortlessUrls({
  WEB_APP_URL: ["collabtime.web"],
});

const { status } = spawnSync("pnpm", ["exec", "turbo", "run", "dev", "--concurrency", "16"], {
  env,
  stdio: "inherit",
});

process.exit(status ?? 1);
