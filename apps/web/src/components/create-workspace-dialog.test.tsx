import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { CreateWorkspaceDialogView } from "./create-workspace-dialog";

it("requires a name and submits a trimmed workspace name", async () => {
  const createWorkspace = vi.fn().mockResolvedValue({ data: "team", success: true });
  const onCreated = vi.fn<(id: string) => void>();
  render(<CreateWorkspaceDialogView createWorkspace={createWorkspace} onCreated={onCreated} />);
  fireEvent.click(screen.getByRole("button", { name: "Create a workspace" }));
  const input = await screen.findByLabelText("Workspace name");
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.blur(input);
  expect(await screen.findByText("Workspace name is required")).toBeVisible();
  expect(createWorkspace).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "  Platform  " } });
  fireEvent.blur(input);
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /^Create workspace$/ })).toBeEnabled();
  });
  fireEvent.click(screen.getByRole("button", { name: /^Create workspace$/ }));
  await waitFor(() => {
    expect(createWorkspace).toHaveBeenCalledWith("Platform");
  });
  expect(onCreated).toHaveBeenCalledWith("team");
});

it("keeps the entered name and reports creation failure", async () => {
  const createWorkspace = vi
    .fn()
    .mockResolvedValue({ error: "Team storage is unavailable", success: false });

  render(
    <CreateWorkspaceDialogView
      createWorkspace={createWorkspace}
      onCreated={vi.fn<(id: string) => void>()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Create a workspace" }));
  fireEvent.change(await screen.findByLabelText("Workspace name"), {
    target: { value: "Platform" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Create workspace$/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Team storage is unavailable");
  expect(screen.getByLabelText("Workspace name")).toHaveValue("Platform");
});
