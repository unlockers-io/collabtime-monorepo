import { describe, expect, it } from "vitest";

import { authErrorKind } from "./auth-error-kind";

describe("authErrorKind", () => {
  it.each([
    [{ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }, "invalid-credentials"],
    [{ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", status: 422 }, "account-exists"],
    [{ code: "INVALID_TOKEN", status: 400 }, "invalid-reset-link"],
    [{ code: "INVALID_EMAIL_OR_PASSWORD", status: 429 }, "rate-limited"],
    [{ code: "toString", status: 400 }, "unknown"],
    [{ status: 500 }, "unknown"],
  ] as const)("maps %o to %s", (error, kind) => {
    expect(authErrorKind(error)).toBe(kind);
  });
});
