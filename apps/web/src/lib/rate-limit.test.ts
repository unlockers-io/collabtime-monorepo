import { describe, expect, it } from "vitest";

import { getClientIp } from "./rate-limit";

const createRequest = (headers: Record<string, string> = {}) =>
  new Request("http://localhost:3000", {
    headers: new Headers(headers),
  });

describe("getClientIp", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const req = createRequest({ "x-forwarded-for": "203.0.113.50, 70.41.3.18" });
    expect(getClientIp(req)).toBe("203.0.113.50");
  });

  it("extracts IP from x-real-ip header", () => {
    const req = createRequest({ "x-real-ip": "203.0.113.50" });
    expect(getClientIp(req)).toBe("203.0.113.50");
  });

  it("extracts IP from x-vercel-forwarded-for header", () => {
    const req = createRequest({ "x-vercel-forwarded-for": "203.0.113.50" });
    expect(getClientIp(req)).toBe("203.0.113.50");
  });

  it("prefers x-forwarded-for over other headers", () => {
    const req = createRequest({
      "x-forwarded-for": "1.1.1.1",
      "x-real-ip": "2.2.2.2",
      "x-vercel-forwarded-for": "3.3.3.3",
    });
    expect(getClientIp(req)).toBe("1.1.1.1");
  });

  it("returns 'unknown' when no headers present", () => {
    const req = createRequest();
    expect(getClientIp(req)).toBe("unknown");
  });
});
