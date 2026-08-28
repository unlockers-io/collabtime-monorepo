import assert from "node:assert/strict";
import test from "node:test";

import { applyPortlessUrls } from "./portless-env.mjs";

await test("resolves scalar and comma-separated Portless URLs", () => {
  const env = {};

  applyPortlessUrls(
    {
      API_URL: "collabtime.api",
      CORS_ORIGINS: ["collabtime.web", "collabtime.landing"],
    },
    { env, resolveUrl: (name) => `https://branch.${name}.localhost` },
  );

  assert.deepEqual(env, {
    API_URL: "https://branch.collabtime.api.localhost",
    CORS_ORIGINS:
      "https://branch.collabtime.web.localhost,https://branch.collabtime.landing.localhost",
  });
});

await test("preserves explicitly configured environment values", () => {
  const env = { API_URL: "https://api.example.com" };

  applyPortlessUrls(
    { API_URL: "collabtime.api" },
    {
      env,
      resolveUrl: () => {
        throw new Error("should not resolve an explicit value");
      },
    },
  );

  assert.equal(env.API_URL, "https://api.example.com");
});
