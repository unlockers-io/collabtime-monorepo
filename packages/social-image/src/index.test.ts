import assert from "node:assert/strict";
import { test } from "node:test";

import { Children, isValidElement } from "react";

import { parseFont, svgText } from "./index.ts";

const positions = (text: string, width: number) => {
  const group = svgText(text, { color: "currentColor", size: 24, width, x: 0, y: 40 });
  return Children.toArray(group.props.children).map((child) => {
    assert.ok(isValidElement<{ transform: string }>(child));
    const match = /translate\((?<x>\S+) (?<y>\S+)\) scale/v.exec(child.props.transform);
    assert.ok(match?.groups);
    return { x: Number(match.groups.x), y: Number(match.groups.y) };
  });
};

await test("renders accented text as finite glyph coordinates", () => {
  const glyphs = positions("São Paulo · reprodução", 400);
  assert.ok(glyphs.length > 15);
  assert.ok(glyphs.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)));
});

await test("wraps words and long unbroken titles within the requested measure", () => {
  for (const text of ["A title with several words", "AnExtremelyLongUnbrokenTitle"]) {
    const glyphs = positions(text, 90);
    assert.ok(new Set(glyphs.map(({ y }) => y)).size > 1);
    assert.ok(glyphs.every(({ x }) => x >= 0 && x < 90));
  }
});

await test("empty text produces no glyphs", () => {
  assert.deepEqual(positions("   ", 200), []);
});

await test("rejects corrupt font data", () => {
  assert.throws(() => parseFont(Buffer.from("invalid font")));
});
