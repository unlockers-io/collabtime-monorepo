import { describe, expect, it } from "vitest";

import { isValidRedirectUrl, redirectUrlSchema } from "./redirect-validation";

describe("isValidRedirectUrl", () => {
  it("accepts localhost URL", () => {
    expect(isValidRedirectUrl("http://localhost:3000/dashboard")).toBe(true);
  });

  it("accepts collabtime.io URL", () => {
    expect(isValidRedirectUrl("https://collabtime.io/settings")).toBe(true);
  });

  it("accepts www.collabtime.io URL", () => {
    expect(isValidRedirectUrl("https://www.collabtime.io/")).toBe(true);
  });

  it("rejects external URL", () => {
    expect(isValidRedirectUrl("https://evil.com/phish")).toBe(false);
  });

  it("rejects URL with different port on localhost", () => {
    expect(isValidRedirectUrl("http://localhost:4000/")).toBe(false);
  });

  it("rejects URL with different protocol", () => {
    expect(isValidRedirectUrl("http://collabtime.io/")).toBe(false);
  });

  it("rejects invalid URL", () => {
    expect(isValidRedirectUrl("not-a-url")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidRedirectUrl("")).toBe(false);
  });
});

describe("redirectUrlSchema", () => {
  it("validates allowed URL", () => {
    expect(redirectUrlSchema.safeParse("https://collabtime.io/page").success).toBe(true);
  });

  it("rejects non-URL string", () => {
    expect(redirectUrlSchema.safeParse("just-a-path").success).toBe(false);
  });

  it("rejects disallowed origin", () => {
    expect(redirectUrlSchema.safeParse("https://attacker.com").success).toBe(false);
  });
});
