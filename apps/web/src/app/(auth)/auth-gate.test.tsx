import { beforeEach, expect, it, vi } from "vitest";

import { createMockSession } from "@/lib/actions/test-helpers";

import { AuthGate as renderAuthGate } from "./auth-gate";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), redirect: vi.fn() }));

vi.mock("@/lib/auth-server", () => ({ getSession: mocks.getSession }));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue(createMockSession());
});

it("preserves an invitation destination for signed-in users", async () => {
  await renderAuthGate({ searchParams: Promise.resolve({ redirect: "/team?invite=abc" }) });
  expect(mocks.redirect).toHaveBeenCalledWith("/team?invite=abc");
});

it.each(["https://evil.example", "//evil.example", undefined])(
  "uses home for an unsafe or missing destination: %s",
  async (redirect) => {
    await renderAuthGate({ searchParams: Promise.resolve({ redirect }) });
    expect(mocks.redirect).toHaveBeenCalledWith("/");
  },
);

it("does not redirect guests", async () => {
  mocks.getSession.mockResolvedValue(null);
  expect(await renderAuthGate({})).toBeNull();
  expect(mocks.redirect).not.toHaveBeenCalled();
});
