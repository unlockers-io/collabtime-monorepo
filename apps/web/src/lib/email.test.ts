import { describe, expect, it } from "vitest";

import { escapeHtml } from "./escape-html";

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;",
    );
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('class="foo"')).toBe("class=&quot;foo&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("handles multiple special characters in one string", () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });

  it("leaves safe text unchanged", () => {
    expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
  });
});
