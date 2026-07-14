import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "./redirect-validation";

describe("safeRedirectPath", () => {
  it("accepts a simple in-app path", () => {
    expect(safeRedirectPath("/team-abc123")).toBe("/team-abc123");
  });

  it("accepts the root path", () => {
    expect(safeRedirectPath("/")).toBe("/");
  });

  it("accepts nested paths with query and hash", () => {
    expect(safeRedirectPath("/settings?tab=account#top")).toBe("/settings?tab=account#top");
  });

  it("defaults absent values to /", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath(undefined)).toBe("/");
  });

  it("rejects empty string", () => {
    expect(safeRedirectPath("")).toBe("/");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/");
    expect(safeRedirectPath("//evil.com/phish")).toBe("/");
  });

  it("rejects backslash tricks", () => {
    // Browsers normalize "\" to "/" during URL parsing, so "/\evil.com"
    // would navigate to evil.com if let through.
    expect(safeRedirectPath(String.raw`/\evil.com`)).toBe("/");
    expect(safeRedirectPath(String.raw`\/evil.com`)).toBe("/");
    expect(safeRedirectPath(String.raw`/path\..\evil`)).toBe("/");
  });

  it("rejects control-character smuggling", () => {
    // The WHATWG URL parser strips tab/LF/CR before parsing, so "/\t/evil.com"
    // reaches the parser as "//evil.com": protocol-relative. The prefix
    // checks can't see it; the anchor-origin resolution is what catches it.
    expect(safeRedirectPath("/\t/evil.com")).toBe("/");
    expect(safeRedirectPath("/\n/evil.com")).toBe("/");
    expect(safeRedirectPath("/\r/evil.com")).toBe("/");
  });

  it("rejects absolute URLs", () => {
    expect(safeRedirectPath("https://evil.com/phish")).toBe("/");
    expect(safeRedirectPath("http://localhost:3000/team")).toBe("/");
  });

  it("rejects scheme-prefixed values", () => {
    // Built dynamically so lint's no-script-url doesn't flag a literal.
    expect(safeRedirectPath(["javascript", "alert(1)"].join(":"))).toBe("/");
    expect(safeRedirectPath("data:text/html,<script>1</script>")).toBe("/");
  });

  it("rejects bare hostnames and relative paths without a leading slash", () => {
    expect(safeRedirectPath("evil.com")).toBe("/");
    expect(safeRedirectPath("team-abc123")).toBe("/");
    expect(safeRedirectPath(" /team-abc123")).toBe("/");
  });
});
