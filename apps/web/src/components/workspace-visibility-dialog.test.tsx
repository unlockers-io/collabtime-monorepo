import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceVisibilityDialog } from "./workspace-visibility-dialog";

const readBody = (body: RequestInit["body"]) => {
  if (typeof body !== "string") {
    throw new TypeError("Expected a JSON request body");
  }
  return JSON.parse(body);
};

const renderDialog = (isPrivate = false, hasPassword = false) => {
  const onSaved = vi.fn<(space: { hasPassword: boolean; isPrivate: boolean }) => void>();
  const onOpenChange = vi.fn<(open: boolean) => void>();
  render(
    <WorkspaceVisibilityDialog
      hasPassword={hasPassword}
      isPrivate={isPrivate}
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      open
      spaceId="space-1"
    />,
  );
  return { onOpenChange, onSaved };
};

const stubSave = (isPrivate: boolean) => {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ space: { hasPassword: isPrivate, isPrivate } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("workspace privacy", () => {
  it("requires a password when making a public workspace private", async () => {
    const fetchMock = stubSave(true);
    renderDialog();
    fireEvent.click(screen.getByRole("switch", { name: "Private workspace" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Password must be at least 8 characters")).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits the password and updates state from the response", async () => {
    const fetchMock = stubSave(true);
    const { onOpenChange, onSaved } = renderDialog();
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.change(screen.getByLabelText("Workspace password"), {
      target: { value: "GuestPassword123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith({ hasPassword: true, isPrivate: true });
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/spaces/space-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(readBody(fetchMock.mock.calls[0]?.[1]?.body)).toEqual({
      password: "GuestPassword123!",
      visibility: "private",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("omits the password to retain an existing one", async () => {
    const fetchMock = stubSave(true);
    renderDialog(true, true);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(readBody(fetchMock.mock.calls[0]?.[1]?.body)).toEqual({ visibility: "private" });
  });

  it("sends only public visibility when disabling privacy", async () => {
    const fetchMock = stubSave(false);
    renderDialog(true, true);
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(readBody(fetchMock.mock.calls[0]?.[1]?.body)).toEqual({ visibility: "public" });
  });

  it("keeps the dialog open after a failed save", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ error: "Forbidden" }, { status: 403 })),
    );
    const { onOpenChange, onSaved } = renderDialog(true, true);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    });
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
