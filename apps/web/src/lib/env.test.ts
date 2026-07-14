import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getEnv, isEnvValid, validateEnv } from "./env";

describe("validateEnv", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/test");
    vi.stubEnv("BETTER_AUTH_SECRET", "a-secret-that-is-at-least-32-characters-long");
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

  it("accepts optional AUTH_ALLOWED_HOSTS", () => {
    vi.stubEnv("AUTH_ALLOWED_HOSTS", "collabtime.io,*.collabtime.io,*.vercel.app");

    const env = validateEnv();
    expect(env.AUTH_ALLOWED_HOSTS).toBe("collabtime.io,*.collabtime.io,*.vercel.app");
  });

  // Unset GitHub Actions secrets expand to "", which must not blow up env validation.
  it("accepts empty string for optional REDIS_URL (CI passes unset secrets as '')", () => {
    vi.stubEnv("REDIS_URL", "");

    expect(() => validateEnv()).not.toThrow();
  });

  it("throws when REDIS_URL is set to a non-URL string", () => {
    vi.stubEnv("REDIS_URL", "not-a-url");

    expect(() => validateEnv()).toThrow("Invalid environment variables");
  });

  it("accepts RESEND_FROM_EMAIL as a bare email", () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "noreply@email.collabtime.io");

    expect(() => validateEnv()).not.toThrow();
  });

  it("accepts RESEND_FROM_EMAIL in 'Display Name <email>' format", () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "Collab Time <noreply@email.collabtime.io>");

    expect(() => validateEnv()).not.toThrow();
  });

  it("throws when RESEND_FROM_EMAIL is not an email or wrapped email", () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "not-an-email");

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

    expect(isEnvValid()).toBe(true);
  });

  it("returns false when required vars are missing", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "");

    expect(isEnvValid()).toBe(false);
  });
});
