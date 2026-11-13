import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { issueAccessCookie, parseAccessCookies, verifyAccessToken } from "./workspace-access";

const HASH = "$2b$10$abcdefghijklmnopqrstuv";
const SPACE_ID = "space-1";

beforeEach(() => {
  vi.stubEnv("SPACE_ACCESS_SECRET", "test-space-secret-at-least-32-characters");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("access cookie", () => {
  it("is an http-only cookie that lasts as long as its token", () => {
    expect(issueAccessCookie(SPACE_ID, HASH)).toMatchObject({
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60,
      name: `space-access-${SPACE_ID}`,
      sameSite: "lax",
    });
  });

  it("does not leak the stored hash into the readable payload", () => {
    const [payload = ""] = issueAccessCookie(SPACE_ID, HASH).value.split(".");

    expect(Buffer.from(payload, "base64url").toString("utf8")).not.toContain(HASH);
  });

  it("falls back to BETTER_AUTH_SECRET without a dedicated secret", () => {
    vi.stubEnv("SPACE_ACCESS_SECRET", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-at-least-32-characters-long");

    expect(verifyAccessToken(issueAccessCookie(SPACE_ID, HASH).value, SPACE_ID, HASH)).toBe(true);
  });

  it("ignores BETTER_AUTH_SECRET rotation when a dedicated secret is present", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "signing-secret-at-least-32-characters-long");
    const { value } = issueAccessCookie(SPACE_ID, HASH);
    vi.stubEnv("BETTER_AUTH_SECRET", "rotated-auth-secret-at-least-32-characters-long");

    expect(verifyAccessToken(value, SPACE_ID, HASH)).toBe(true);
  });

  it("parses access cookies out of a cookie header", () => {
    expect(parseAccessCookies(null)).toEqual([]);
    expect(
      parseAccessCookies(
        "session=abc; space-access-a=one; theme; space-access-b=t%3Dwo; space-access-c=%E0",
      ),
    ).toEqual([
      { spaceId: "a", token: "one" },
      { spaceId: "b", token: "t=wo" },
      { spaceId: "c", token: "%E0" },
    ]);
  });
});
