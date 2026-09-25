import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import type { ActionResult } from "@/lib/actions/types";

import { SettingsView } from "./client";

const user = { email: "ada@example.com", id: "user-1", name: "Ada" };

const renderSettings = (result: ActionResult<null>) => {
  const saveName = vi.fn<(name: string) => Promise<ActionResult<null>>>().mockResolvedValue(result);
  const onSaved = vi.fn<() => void>();
  render(<SettingsView onSaved={onSaved} saveName={saveName} user={user} />);
  return { onSaved, saveName };
};

it("saves a trimmed name once it differs from the current one", async () => {
  const { onSaved, saveName } = renderSettings({ data: null, success: true });

  expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
  const save = screen.getByRole("button", { name: "Save changes" });
  expect(save).toBeDisabled();

  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "  Ada Lovelace  " } });
  await waitFor(() => {
    expect(save).toBeEnabled();
  });
  fireEvent.click(save);

  await waitFor(() => {
    expect(saveName).toHaveBeenCalledWith("Ada Lovelace");
  });
  expect(onSaved).toHaveBeenCalledOnce();
});

it("rejects an empty name without saving", async () => {
  const { saveName } = renderSettings({ data: null, success: true });
  const input = screen.getByLabelText("Full name");

  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.blur(input);

  expect(await screen.findByText("Name is required")).toBeVisible();
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  expect(saveName).not.toHaveBeenCalled();
});

it("shows the email as read-only", () => {
  renderSettings({ data: null, success: true });

  expect(screen.getByLabelText("Email")).toBeDisabled();
  expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
});
