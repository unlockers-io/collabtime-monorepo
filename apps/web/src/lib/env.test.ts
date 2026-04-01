import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getEnv, isEnvValid, validateEnv } from "./env";

describe("validateEnv", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/test");
    vi.stubEnv("BETTER_AUTH_SECRET", "a-secret-that-is-at-least-32-characters-long");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("succeeds with all required env vars set", () => {
    expect(() => validateEnv()).not.toThrow();
  });

  it("returns parsed env object", () => {
    const env = validateEnv();
    expect(env.DATABASE_URL).toBe("postgresql://localhost:5432/test");
    expect(env.NODE_ENV).toBe("test");
  });

  it("throws when DATABASE_URL is missing", () => {
    vi.stubEnv("DATABASE_URL", "");

    expect(() => validateEnv()).toThrow("Invalid environment variables");
  });

  it("throws when BETTER_AUTH_SECRET is too short", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "short");

    expect(() => validateEnv()).toThrow("Invalid environment variables");
  });

  it("throws when BETTER_AUTH_URL is not a valid URL", () => {
    vi.stubEnv("BETTER_AUTH_URL", "not-a-url");

    expect(() => validateEnv()).toThrow("Invalid environment variables");
  });
});

describe("getEnv", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the env var value", () => {
    expect(getEnv("DATABASE_URL")).toBe("postgresql://localhost:5432/test");
  });

  it("returns undefined for unset optional vars", () => {
    expect(getEnv("RESEND_API_KEY")).toBeUndefined();
  });
});

describe("isEnvValid", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true when all required vars are set", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/test");
    vi.stubEnv("BETTER_AUTH_SECRET", "a-secret-that-is-at-least-32-characters-long");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");

    expect(isEnvValid()).toBe(true);
  });

  it("returns false when required vars are missing", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    vi.stubEnv("BETTER_AUTH_URL", "");

    expect(isEnvValid()).toBe(false);
  });
});
