// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VALID_UUID } from "./actions/test-helpers";
import { createTeamEventsHandler, type TeamEventHandlerDeps } from "./team-event-handler";
import type { TeamListener } from "./team-events";
import { captureAccessCheck, issueAccessCookie, type WorkspaceSpace } from "./workspace-access";
import { createTestAccessStore } from "./workspace-access-test-store";

const setup = () => {
  const space: WorkspaceSpace = {
    accessPassword: "password-hash",
    id: "space-1",
    isPrivate: false,
    teamId: VALID_UUID,
  };
  const findSpace = vi.fn<TeamEventHandlerDeps["findSpace"]>().mockResolvedValue(space);
  const access = createTestAccessStore();
  const viewer: { userId?: string } = {};
  const captureAccess = vi.fn<TeamEventHandlerDeps["captureAccess"]>(async (spaceId) => ({
    canView: await captureAccessCheck(spaceId, viewer.userId, access.store),
    userId: viewer.userId,
  }));
  const listeners = new Set<TeamListener>();
  const release = vi.fn<() => Promise<void>>().mockResolvedValue();
  const acquire = vi
    .fn<TeamEventHandlerDeps["acquire"]>()
    .mockResolvedValue({ allowed: true, release });
  const enabled = vi.fn(() => true);
  const hub = {
    isReady: () => true,
    subscribe: (_teamId: string, listener: TeamListener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    waitUntilReady: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  };
  const handle = createTeamEventsHandler({
    acquire,
    captureAccess,
    enabled,
    findSpace,
    hub,
    log: { error: vi.fn<() => void>(), info: vi.fn<() => void>(), warn: vi.fn<() => void>() },
  });
  const request = new Request(`http://localhost/api/teams/${VALID_UUID}/events`, {
    headers: { "x-forwarded-for": "192.0.2.1, 192.0.2.2" },
  });
  return {
    access,
    acquire,
    captureAccess,
    enabled,
    findSpace,
    handle,
    hub,
    listeners,
    release,
    request,
    space,
    viewer,
  };
};

beforeEach(() => {
  vi.stubEnv("SPACE_ACCESS_SECRET", "test-space-access-secret-with-32-characters");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("team events handler", () => {
  it("rejects invalid IDs before accessing storage", async () => {
    const state = setup();
    const response = await state.handle(state.request, "bad-id");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid team ID" });
    expect(state.findSpace).not.toHaveBeenCalled();
  });

  it("returns 404 for absent spaces and 403 for private guests", async () => {
    const state = setup();
    state.findSpace.mockResolvedValueOnce(null);
    await expect(state.handle(state.request, VALID_UUID)).resolves.toHaveProperty("status", 404);
    state.space.isPrivate = true;
    await expect(state.handle(state.request, VALID_UUID)).resolves.toHaveProperty("status", 403);
    expect(state.acquire).not.toHaveBeenCalled();
  });

  it("checks access through HEAD even when live sync is disabled, without opening a stream", async () => {
    const state = setup();
    state.enabled.mockReturnValue(false);
    const request = new Request(state.request, { method: "HEAD" });
    const response = await state.handle(request, VALID_UUID);
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    state.space.isPrivate = true;
    await expect(state.handle(request, VALID_UUID)).resolves.toHaveProperty("status", 403);
    state.findSpace.mockResolvedValue(null);
    await expect(state.handle(request, VALID_UUID)).resolves.toHaveProperty("status", 404);
    expect(state.hub.waitUntilReady).not.toHaveBeenCalled();
    expect(state.acquire).not.toHaveBeenCalled();
    expect(state.listeners.size).toBe(0);
  });

  it("checks current membership and password grants on HEAD requests", async () => {
    const state = setup();
    const request = new Request(state.request, { method: "HEAD" });
    state.space.isPrivate = true;
    state.access.setToken(state.space.id, issueAccessCookie(state.space.id, "password-hash").value);
    await expect(state.handle(request, VALID_UUID)).resolves.toHaveProperty("status", 204);
    state.space.accessPassword = "rotated-password-hash";
    await expect(state.handle(request, VALID_UUID)).resolves.toHaveProperty("status", 403);
    state.viewer.userId = "member-1";
    state.access.addMembership(VALID_UUID, "member-1");
    await expect(state.handle(request, VALID_UUID)).resolves.toHaveProperty("status", 204);
    state.access.removeMembership(VALID_UUID, "member-1");
    await expect(state.handle(request, VALID_UUID)).resolves.toHaveProperty("status", 403);
    expect(state.acquire).not.toHaveBeenCalled();
  });

  it("opens for public guests and uses the first forwarded IP for admission", async () => {
    const state = setup();
    const response = await state.handle(state.request, VALID_UUID);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(state.acquire).toHaveBeenCalledWith("ip:192.0.2.1", false);
    await response.body!.cancel();
    expect(state.release).toHaveBeenCalledTimes(1);
  });

  it("allows private members and denies signed-in nonmembers", async () => {
    const state = setup();
    state.space.isPrivate = true;
    state.viewer.userId = "user-1";
    await expect(state.handle(state.request, VALID_UUID)).resolves.toHaveProperty("status", 403);
    state.access.addMembership(VALID_UUID, "user-1");
    const response = await state.handle(state.request, VALID_UUID);
    expect(response.status).toBe(200);
    expect(state.acquire).toHaveBeenCalledWith("user:user-1", true);
    await response.body!.cancel();
  });

  it("rechecks password rotation using only the captured cookie", async () => {
    const state = setup();
    state.space.isPrivate = true;
    state.access.setToken(state.space.id, issueAccessCookie(state.space.id, "password-hash").value);
    const response = await state.handle(state.request, VALID_UUID);
    const reader = response.body!.getReader();
    const readyFrame = await reader.read();
    expect(new TextDecoder().decode(readyFrame.value)).toContain("event: ready");
    state.space.accessPassword = "rotated-password-hash";
    for (const listener of state.listeners) {
      listener({ at: Date.now(), kind: "space", teamId: VALID_UUID });
    }
    const revokedFrame = await reader.read();
    expect(new TextDecoder().decode(revokedFrame.value)).toContain("event: revoked");
    await expect(reader.read()).resolves.toHaveProperty("done", true);
    expect(state.access.store.getToken).toHaveBeenCalledTimes(1);
    expect(state.release).toHaveBeenCalledTimes(1);
  });

  it("detects deletion between admission and the final access check", async () => {
    const state = setup();
    state.findSpace.mockResolvedValueOnce(state.space).mockResolvedValue(null);
    const response = await state.handle(state.request, VALID_UUID);
    expect(await response.text()).toContain("event: deleted");
    expect(state.release).toHaveBeenCalledTimes(1);
  });

  it.each([429, 503] as const)("returns %s when admission refuses the stream", async (status) => {
    const state = setup();
    state.acquire.mockResolvedValue({ allowed: false, status });
    await expect(state.handle(state.request, VALID_UUID)).resolves.toHaveProperty("status", status);
    expect(state.listeners.size).toBe(0);
  });

  it("falls back when disabled or the subscriber is unavailable", async () => {
    const state = setup();
    state.enabled.mockReturnValue(false);
    await expect(state.handle(state.request, VALID_UUID)).resolves.toHaveProperty("status", 503);
    expect(state.findSpace).not.toHaveBeenCalled();
    state.enabled.mockReturnValue(true);
    state.hub.waitUntilReady.mockResolvedValue(false);
    await expect(state.handle(state.request, VALID_UUID)).resolves.toHaveProperty("status", 503);
    expect(state.acquire).not.toHaveBeenCalled();
  });
});
