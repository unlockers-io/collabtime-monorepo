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

it("keeps save disabled while the name is empty, without showing an error", () => {
  const { saveName } = renderSettings({ data: null, success: true });
  const input = screen.getByLabelText("Full name");

  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.blur(input);

  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  expect(screen.queryByText("Name is required")).not.toBeInTheDocument();
  expect(input).toHaveAttribute("aria-invalid", "false");
  expect(saveName).not.toHaveBeenCalled();
});

it("explains the length limit and reports a failed save in the form alert until the next change", async () => {
  const { onSaved } = renderSettings({ error: "Failed to update name", success: false });
  const input = screen.getByLabelText("Full name");
  expect(input).toHaveAccessibleDescription("Up to 100 characters.");

  fireEvent.change(input, { target: { value: "Ada Lovelace" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Failed to update name");
  expect(onSaved).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "Ada King" } });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("shows the email as read-only", () => {
  renderSettings({ data: null, success: true });

  expect(screen.getByLabelText("Email")).toBeDisabled();
  expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
});
