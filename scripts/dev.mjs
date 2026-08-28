import { spawn } from "node:child_process";

import { applyPortlessUrls } from "./portless-env.mjs";

applyPortlessUrls({
  CORS_ORIGINS: ["collabtime.web"],
  WEB_APP_URL: "collabtime.web",
});

const child = spawn("pnpm", ["exec", "turbo", "dev"], {
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
