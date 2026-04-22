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
    const token = createSpaceAccessToken("space-123", "127.0.0.1");
    const result = verifySpaceAccessToken(token, "space-123");

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.spaceId).toBe("space-123");
      expect(result.payload.clientIp).toBe("127.0.0.1");
    }
  });

  it("rejects token with wrong space ID", () => {
    const token = createSpaceAccessToken("space-123", "127.0.0.1");
    const result = verifySpaceAccessToken(token, "space-456");

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("Space ID mismatch");
    }
  });

  it("rejects token with wrong IP when strict check enabled", () => {
    const token = createSpaceAccessToken("space-123", "127.0.0.1");
    const result = verifySpaceAccessToken(token, "space-123", "192.168.1.1");

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("IP address mismatch");
    }
  });

  it("accepts token without IP check when not provided", () => {
    const token = createSpaceAccessToken("space-123", "127.0.0.1");
    const result = verifySpaceAccessToken(token, "space-123");

    expect(result.valid).toBe(true);
  });

  it("rejects tampered token", () => {
    const token = createSpaceAccessToken("space-123", "127.0.0.1");
    const tampered = `${token.slice(0, -5)}XXXXX`;
    const result = verifySpaceAccessToken(tampered, "space-123");

    expect(result.valid).toBe(false);
  });

  it("rejects invalid token format", () => {
    const result = verifySpaceAccessToken("not.a.valid.token", "space-123");
    expect(result.valid).toBe(false);
  });

  it("rejects expired token", () => {
    // Create token, then advance time past expiry
    const token = createSpaceAccessToken("space-123", "127.0.0.1");

    vi.useFakeTimers();
    vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000); // 8 days

    const result = verifySpaceAccessToken(token, "space-123");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("Token expired");
    }

    vi.useRealTimers();
  });
});
