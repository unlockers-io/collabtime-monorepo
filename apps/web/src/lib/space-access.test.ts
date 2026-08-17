import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSpaceAccessToken, verifySpaceAccessToken } from "./space-access";

const HASH = "$2b$10$abcdefghijklmnopqrstuv";

describe("space-access tokens", () => {
  beforeEach(() => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-at-least-32-characters-long");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates and verifies a valid token", () => {
    const token = createSpaceAccessToken("space-123", HASH);
    const result = verifySpaceAccessToken(token, "space-123", HASH);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.spaceId).toBe("space-123");
    }
  });

  it("rejects token with wrong space ID", () => {
    const token = createSpaceAccessToken("space-123", HASH);
    const result = verifySpaceAccessToken(token, "space-456", HASH);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("Space ID mismatch");
    }
  });

  it("rejects tampered token", () => {
    const token = createSpaceAccessToken("space-123", HASH);
    const tampered = `${token.slice(0, -5)}XXXXX`;
    const result = verifySpaceAccessToken(tampered, "space-123", HASH);

    expect(result.valid).toBe(false);
  });

  it("rejects invalid token format", () => {
    const result = verifySpaceAccessToken("not.a.valid.token", "space-123", HASH);
    expect(result.valid).toBe(false);
  });

  it("rejects expired token", () => {
    const token = createSpaceAccessToken("space-123", HASH);

    vi.useFakeTimers();
    vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000); // 8 days

    const result = verifySpaceAccessToken(token, "space-123", HASH);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("Token expired");
    }

    vi.useRealTimers();
  });

  it("rejects a token issued against a password that has since been rotated", () => {
    const token = createSpaceAccessToken("space-123", HASH);

    const result = verifySpaceAccessToken(token, "space-123", "$2b$10$a-completely-different");

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("Credential changed");
    }
  });

  it("rejects any token once the space has no password", () => {
    const token = createSpaceAccessToken("space-123", HASH);

    const result = verifySpaceAccessToken(token, "space-123", null);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("No space credential");
    }
  });

  it("does not leak the stored hash into the token payload", () => {
    const token = createSpaceAccessToken("space-123", HASH);
    const [payloadStr] = token.split(".");
    const decoded = Buffer.from(payloadStr ?? "", "base64url").toString("utf8");

    expect(decoded).not.toContain(HASH);
  });

  it("signs and verifies with a dedicated secret (no fallback)", () => {
    vi.stubEnv("SPACE_ACCESS_SECRET", "dedicated-space-secret-at-least-32-chars-long");
    vi.stubEnv("BETTER_AUTH_SECRET", "");

    const token = createSpaceAccessToken("space-123", HASH);
    const result = verifySpaceAccessToken(token, "space-123", HASH);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.spaceId).toBe("space-123");
    }
  });

  it("ignores BETTER_AUTH_SECRET when a dedicated secret is present", () => {
    vi.stubEnv("SPACE_ACCESS_SECRET", "dedicated-space-secret-at-least-32-chars-long");
    vi.stubEnv("BETTER_AUTH_SECRET", "signing-secret-at-least-32-characters-long");

    const token = createSpaceAccessToken("space-123", HASH);

    vi.stubEnv("BETTER_AUTH_SECRET", "rotated-auth-secret-at-least-32-characters-long");

    const result = verifySpaceAccessToken(token, "space-123", HASH);
    expect(result.valid).toBe(true);
  });
});
