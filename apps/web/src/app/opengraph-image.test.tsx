// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import renderOpengraphImage, { contentType, size } from "./opengraph-image";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/test");
  vi.stubEnv("BETTER_AUTH_SECRET", "a-secret-that-is-at-least-32-characters-long");
  vi.stubEnv("WEB_APP_URL", "https://collabtime.io");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("renders a PNG from bundled fonts without any network request", async () => {
  const fetchSpy = vi
    .fn<(input: RequestInfo | URL) => Promise<Response>>()
    .mockRejectedValue(new Error("Network disabled"));
  vi.stubGlobal("fetch", fetchSpy);

  const response = renderOpengraphImage();
  const bytes = new Uint8Array(await response.arrayBuffer());
  const requested = fetchSpy.mock.calls.map(([input]) =>
    input instanceof Request ? input.url : input.toString(),
  );

  expect(contentType).toBe("image/png");
  expect(size).toEqual({ height: 630, width: 1200 });
  expect(bytes.slice(0, 8)).toEqual(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(requested.filter((url) => url.startsWith("http"))).toEqual([]);
});
