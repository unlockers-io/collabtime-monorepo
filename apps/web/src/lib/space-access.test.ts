import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSpaceAccessToken, verifySpaceAccessToken } from "./space-access";

describe("space-access tokens", () => {
  beforeEach(() => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-at-least-32-characters-long");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates and verifies a valid token", () => {
    const token = createSpaceAccessToken("space-123");
    const result = verifySpaceAccessToken(token, "space-123");

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.spaceId).toBe("space-123");
    }
  });

  it("rejects token with wrong space ID", () => {
    const token = createSpaceAccessToken("space-123");
    const result = verifySpaceAccessToken(token, "space-456");

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("Space ID mismatch");
    }
  });

  it("rejects tampered token", () => {
    const token = createSpaceAccessToken("space-123");
    const tampered = `${token.slice(0, -5)}XXXXX`;
    const result = verifySpaceAccessToken(tampered, "space-123");

    expect(result.valid).toBe(false);
  });

  it("rejects invalid token format", () => {
    const result = verifySpaceAccessToken("not.a.valid.token", "space-123");
    expect(result.valid).toBe(false);
  });

  it("rejects expired token", () => {
    const token = createSpaceAccessToken("space-123");

    vi.useFakeTimers();
    vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000); // 8 days

    const result = verifySpaceAccessToken(token, "space-123");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("Token expired");
    }

    vi.useRealTimers();
  });

  it("signs and verifies with a dedicated secret (no fallback)", () => {
    // Clear BETTER_AUTH_SECRET so the dedicated path is genuinely isolated;
    // an empty string is falsy, so getSigningSecret cannot fall back to it.
    vi.stubEnv("SPACE_ACCESS_SECRET", "dedicated-space-secret-at-least-32-chars-long");
    vi.stubEnv("BETTER_AUTH_SECRET", "");

    const token = createSpaceAccessToken("space-123");
    const result = verifySpaceAccessToken(token, "space-123");

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.spaceId).toBe("space-123");
    }
  });

  it("ignores BETTER_AUTH_SECRET when a dedicated secret is present", () => {
    vi.stubEnv("SPACE_ACCESS_SECRET", "dedicated-space-secret-at-least-32-chars-long");
    vi.stubEnv("BETTER_AUTH_SECRET", "signing-secret-at-least-32-characters-long");

    const token = createSpaceAccessToken("space-123");

    // Rotate the auth secret while the dedicated secret stays put; the token must
    // still verify because the auth secret is never consulted.
    vi.stubEnv("BETTER_AUTH_SECRET", "rotated-auth-secret-at-least-32-characters-long");

    const result = verifySpaceAccessToken(token, "space-123");
    expect(result.valid).toBe(true);
  });
});
