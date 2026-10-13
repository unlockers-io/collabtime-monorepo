import { describe, expect, it } from "vitest";

import { applyPortlessUrls, portlessUrl } from "./index";

const worktree = (prefix: string) => {
  const calls: Array<Array<string>> = [];
  const run = (file: string, args: ReadonlyArray<string>) => {
    calls.push([file, ...args]);
    return `https://${prefix}.${args.at(-1)}.localhost\n`;
  };
  return { calls, run };
};

const failing = () => {
  throw new Error("spawnSync portless ENOENT");
};

describe("portlessUrl", () => {
  it("asks portless for the app's worktree-prefixed URL", () => {
    const { calls, run } = worktree("fix-styles");
    expect(portlessUrl("web", { run })).toBe("https://fix-styles.collabtime.web.localhost");
    expect(calls).toEqual([["portless", "get", "collabtime.web"]]);
  });

  it("throws when portless cannot run", () => {
    expect(() => portlessUrl("web", { run: failing })).toThrow("spawnSync portless ENOENT");
  });

  it("throws when portless prints something other than a URL", () => {
    expect(() => portlessUrl("web", { run: () => "no route\n" })).toThrow(
      'portless get collabtime.web printed "no route" instead of a URL',
    );
  });
});

describe("applyPortlessUrls", () => {
  it("does nothing outside a portless child", () => {
    for (const env of [{}, { PORTLESS_URL: "" }]) {
      const { calls, run } = worktree("fix-styles");
      applyPortlessUrls(["WEB_APP_URL"], { env, run });
      expect(env).not.toHaveProperty("WEB_APP_URL");
      expect(calls).toEqual([]);
    }
  });

  it("fills unset and empty keys from portless", () => {
    const { run } = worktree("fix-styles");
    const env = { PORTLESS_URL: "https://fix-styles.collabtime.web.localhost", WEB_APP_URL: "" };
    applyPortlessUrls(["CORS_ORIGINS", "WEB_APP_URL"], { env, run });
    expect(env).toMatchObject({
      CORS_ORIGINS: "https://fix-styles.collabtime.web.localhost",
      WEB_APP_URL: "https://fix-styles.collabtime.web.localhost",
    });
  });

  it("replaces canonical local defaults on any scheme or port", () => {
    const { run } = worktree("fix-styles");
    const env = {
      CORS_ORIGINS: "http://collabtime.web.localhost:1355",
      PORTLESS_URL: "https://fix-styles.collabtime.web.localhost",
      WEB_APP_URL: "https://collabtime.web.localhost",
    };
    applyPortlessUrls(["CORS_ORIGINS", "WEB_APP_URL"], { env, run });
    expect(env).toMatchObject({
      CORS_ORIGINS: "https://fix-styles.collabtime.web.localhost",
      WEB_APP_URL: "https://fix-styles.collabtime.web.localhost",
    });
  });

  it("keeps values that are not the canonical default", () => {
    const explicit = {
      CORS_ORIGINS: "https://collabtime.web.localhost,https://app.example.com",
      WEB_APP_URL: "https://other.collabtime.web.localhost",
    };
    const { calls, run } = worktree("fix-styles");
    const env = { ...explicit, PORTLESS_URL: "https://fix-styles.collabtime.web.localhost" };
    applyPortlessUrls(["CORS_ORIGINS", "WEB_APP_URL"], { env, run });
    expect(env).toMatchObject(explicit);
    expect(calls).toEqual([]);
  });

  it("looks each app up once per call", () => {
    const { calls, run } = worktree("fix-styles");
    const env = { PORTLESS_URL: "https://fix-styles.collabtime.web.localhost" };
    applyPortlessUrls(["CORS_ORIGINS", "WEB_APP_URL"], { env, run });
    expect(calls).toEqual([["portless", "get", "collabtime.web"]]);
  });

  it("throws instead of leaving a key half-filled when the lookup fails", () => {
    const env = { PORTLESS_URL: "https://collabtime.web.localhost" };
    expect(() => {
      applyPortlessUrls(["CORS_ORIGINS"], { env, run: failing });
    }).toThrow("spawnSync portless ENOENT");
    expect(env).not.toHaveProperty("CORS_ORIGINS");
  });
});
