import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./crypto";

describe("password hashing", () => {
  it("hashes a password", async () => {
    const hash = await hashPassword("TestPassword123!");
    expect(hash).toBeDefined();
    expect(hash).not.toBe("TestPassword123!");
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("verifies correct password", async () => {
    const hash = await hashPassword("TestPassword123!");
    const isValid = await verifyPassword("TestPassword123!", hash);
    expect(isValid).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("TestPassword123!");
    const isValid = await verifyPassword("WrongPassword!", hash);
    expect(isValid).toBe(false);
  });

  it("produces different hashes for same password", async () => {
    const hash1 = await hashPassword("TestPassword123!");
    const hash2 = await hashPassword("TestPassword123!");
    expect(hash1).not.toBe(hash2);
  });
});
